#!/usr/bin/env python3
"""
Reweave camera bridge -- feasibility test.

Triggers the Arduino (Nano 33 BLE Sense + OV7675) to take one photo, pulls the
raw frame over USB serial, decodes it to a PNG, and (optionally) feeds it to the
existing Reweave vision pipeline at POST /api/vision/detect -- exactly the same
endpoint the web "Capture" page uses. The backend can't tell the difference
between this and an iPhone upload.

Typical use:
    python capture.py                 # capture + save a PNG, auto-detect port
    python capture.py --post          # also run it through the real pipeline
    python capture.py --port /dev/cu.usbmodem1101 --upscale 3 --post

If the colors look wrong in the PNG, add --byteswap (RGB565 byte order varies).
"""

import argparse
import struct
import sys
import time
from datetime import datetime
from pathlib import Path

try:
    import serial
    from serial.tools import list_ports
except ImportError:
    sys.exit("Missing pyserial. Run:  pip install -r requirements.txt")

try:
    from PIL import Image
except ImportError:
    sys.exit("Missing Pillow. Run:  pip install -r requirements.txt")

import numpy as np

MAGIC = b"\xAA\x55"
# width u16, height u16, bpp u8, irPresent u8, sR/sG/sB/sClear u16, sProx u8
HEADER_FMT = "<HHBBHHHHB"
HEADER_LEN = struct.calcsize(HEADER_FMT)


def parse_header(raw_header: bytes):
    """Return (w, h, bpp, sensor_dict) from a packed header."""
    w, h, bpp, present, sr, sg, sb, sc, prox = struct.unpack(HEADER_FMT, raw_header)
    sensor = {
        "present": bool(present),
        "r": sr, "g": sg, "b": sb, "clear": sc, "proximity": prox,
    }
    return w, h, bpp, sensor
DEFAULT_DETECT_URL = "http://localhost:8000/api/vision/detect"

CAPTURES_DIR = Path(__file__).resolve().parent.parent / "captures"


def autodetect_port() -> str | None:
    """Pick the most likely Arduino port (Nano 33 BLE shows as usbmodem on mac)."""
    candidates = list(list_ports.comports())
    for p in candidates:
        name = (p.device or "").lower()
        desc = (p.description or "").lower()
        if "usbmodem" in name or "arduino" in desc or "nano" in desc or "mbed" in desc:
            return p.device
    # Fall back to the first non-Bluetooth serial device.
    for p in candidates:
        if "bluetooth" not in (p.device or "").lower():
            return p.device
    return None


def read_exact(ser: serial.Serial, n: int, deadline: float) -> bytes:
    """Read exactly n bytes or raise on timeout."""
    buf = bytearray()
    while len(buf) < n:
        if time.time() > deadline:
            raise TimeoutError(f"got {len(buf)} of {n} bytes before timeout")
        chunk = ser.read(n - len(buf))
        if chunk:
            buf.extend(chunk)
    return bytes(buf)


def sync_to_magic(ser: serial.Serial, deadline: float) -> None:
    """Slide along the stream until we hit the 0xAA 0x55 frame marker.

    Anything before the marker is the board's text banner / log lines, which
    we print so you can see what the firmware is saying.
    """
    window = b""
    line = bytearray()
    while True:
        if time.time() > deadline:
            raise TimeoutError("never saw frame magic 0xAA55 (is the sketch running?)")
        b = ser.read(1)
        if not b:
            continue
        window = (window + b)[-2:]
        if window == MAGIC:
            if line.strip():
                print(f"  [board] {line.decode('ascii', 'replace').strip()}")
            return
        # accumulate printable banner text for visibility
        if b in (b"\n", b"\r"):
            if line.strip():
                print(f"  [board] {line.decode('ascii', 'replace').strip()}")
            line = bytearray()
        elif 32 <= b[0] < 127:
            line += b


def rgb565_to_rgb(raw: bytes, w: int, h: int, byteswap: bool) -> np.ndarray:
    """Vectorized RGB565 -> RGB uint8 (h, w, 3)."""
    arr = np.frombuffer(raw, dtype=np.uint8).astype(np.uint16)
    b0 = arr[0::2]
    b1 = arr[1::2]
    px = ((b1 << 8) | b0) if byteswap else ((b0 << 8) | b1)
    r = ((px >> 11) & 0x1F) * 255 // 31
    g = ((px >> 5) & 0x3F) * 255 // 63
    b = (px & 0x1F) * 255 // 31
    return np.stack([r, g, b], axis=1).astype(np.uint8).reshape(h, w, 3)


def capture(args) -> Path:
    port = args.port or autodetect_port()
    if not port:
        sys.exit("No serial port found. Plug in the board, or pass --port explicitly.\n"
                 "List ports with:  python -m serial.tools.list_ports -v")
    print(f"Opening {port} ...")

    with serial.Serial(port, args.baud, timeout=0.2) as ser:
        time.sleep(2.0)            # let the board reset after the port opens
        ser.reset_input_buffer()
        ser.write(b"c")           # trigger one capture
        ser.flush()

        deadline = time.time() + args.timeout
        print("Waiting for frame ...")
        sync_to_magic(ser, deadline)

        header = read_exact(ser, HEADER_LEN, deadline)
        w, h, bpp, sensor = parse_header(header)
        if bpp != 2 or not (0 < w <= 1024 and 0 < h <= 1024):
            sys.exit(f"Bad header (w={w} h={h} bpp={bpp}); try replugging / re-flashing.")
        print(f"Frame: {w}x{h}, {bpp} bytes/pixel ({w*h*bpp} bytes)")

        raw = read_exact(ser, w * h * bpp, deadline)

    rgb = rgb565_to_rgb(raw, w, h, args.byteswap)
    if not args.raw:
        import color  # local module; BGR in/out
        bgr = color.correct(rgb[:, :, ::-1].copy())
        rgb = bgr[:, :, ::-1].copy()
    img = Image.fromarray(rgb, "RGB")
    if args.upscale > 1:
        img = img.resize((w * args.upscale, h * args.upscale), Image.LANCZOS)

    CAPTURES_DIR.mkdir(exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_path = CAPTURES_DIR / f"capture_{stamp}.png"
    img.save(out_path)
    print(f"Saved -> {out_path}")

    # IR / reflectance hint (low-weight, see ir.py)
    import ir
    hint = ir.material_hint(sensor)
    if hint["available"]:
        print(f"IR sensor (APDS-9960): reflectance={hint['reflectance']} "
              f"-> leans {hint['guess']} (conf {hint['confidence']}, "
              f"weight {ir.IR_WEIGHT*100:.2f}%)")
    else:
        print(f"IR sensor: {hint.get('note', 'unavailable')}")

    return out_path, sensor, hint


def post_to_pipeline(img_path: Path, url: str, hint: dict) -> None:
    try:
        import requests
    except ImportError:
        sys.exit("Missing requests. Run:  pip install -r requirements.txt")
    print(f"\nPOST {url} ...")
    try:
        with open(img_path, "rb") as f:
            resp = requests.post(
                url,
                files={"image": (img_path.name, f, "image/png")},
                data={"use_deployment": "false"},   # local CV path, no external SAM call
                timeout=120,
            )
    except requests.exceptions.ConnectionError:
        print("  Could not reach the backend. Is it running on :8000?")
        print("  Start it, or skip --post and just eyeball the PNG.")
        return
    print(f"  HTTP {resp.status_code}")
    try:
        data = resp.json()
    except ValueError:
        print(f"  (non-JSON response) {resp.text[:300]}")
        return
    groups = data.get("groups") or data.get("color_groups") or []
    pieces = data.get("pieces") or data.get("detections") or []
    print(f"  pieces detected: {len(pieces)}")
    print(f"  color/material groups: {len(groups)}")
    for g in groups[:8]:
        label = g.get("color_name") or g.get("name") or g.get("label") or "?"
        fab = g.get("fabric_type") or g.get("material") or ""
        print(f"    - {label} {('(' + fab + ')') if fab else ''}")

    # Blend the IR hint into the pipeline confidence at ~0.01% weight.
    import ir
    # the pipeline doesn't expose a single confidence, so use a representative
    # value just to demonstrate the (negligible) blend
    base_conf = float((groups[0].get("confidence") if groups else None) or 0.9)
    b = ir.blend(base_conf, hint)
    print(f"  + IR contribution: {b['ir_contribution']:+.6f} "
          f"(weight {b['ir_weight']*100:.2f}%); classification unchanged="
          f"{not b['changed']}")


def main():
    ap = argparse.ArgumentParser(description="Reweave Arduino camera bridge (feasibility test)")
    ap.add_argument("--port", help="serial port (auto-detected if omitted)")
    ap.add_argument("--baud", type=int, default=115200, help="ignored on native USB, default 115200")
    ap.add_argument("--timeout", type=float, default=30.0, help="seconds to wait for a full frame")
    ap.add_argument("--byteswap", action="store_true", help="flip RGB565 byte order if colors look wrong")
    ap.add_argument("--raw", action="store_true", help="skip color correction (save the raw sensor colors)")
    ap.add_argument("--upscale", type=int, default=1, help="integer upscale factor for the saved PNG")
    ap.add_argument("--post", action="store_true", help="also run the image through /api/vision/detect")
    ap.add_argument("--url", default=DEFAULT_DETECT_URL, help="detect endpoint URL")
    args = ap.parse_args()

    out_path, sensor, hint = capture(args)

    # sidecar JSON so each capture carries its IR reading
    import json
    sidecar = out_path.with_suffix(".json")
    sidecar.write_text(json.dumps({"sensor": sensor, "ir_hint": hint}, indent=2))

    if args.post:
        post_to_pipeline(out_path, args.url, hint)
    print("\nDone. Open the PNG and judge: can you tell the fabric type / color?")


if __name__ == "__main__":
    main()
