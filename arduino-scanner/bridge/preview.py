#!/usr/bin/env python3
"""
Reweave camera LIVE PREVIEW.

Keeps the serial port open and continuously pulls frames from the Arduino so you
can aim the camera, check focus, and dial in lighting in real time before
building a mount. Shares the same frame protocol as capture.py.

    python preview.py
    python preview.py --upscale 3 --port /dev/cu.usbmodem1401

Keys (focus the preview window first):
    s     save the current frame as a PNG in ../captures/
    c     toggle color correction on / off (compare to raw sensor)
    1 2   Red   gain  - / +
    3 4   Green gain  - / +
    5 6   Blue  gain  - / +
    g     print the current gains (paste into color.py DEFAULT_GAIN)
    b     toggle RGB565 byteswap
    +/-   on-screen zoom
    q     or ESC to quit
"""

import argparse
import sys
import time
from datetime import datetime
from pathlib import Path

import numpy as np

try:
    import serial
except ImportError:
    sys.exit("Missing pyserial. Run:  pip install -r requirements.txt")

try:
    import cv2
except ImportError:
    sys.exit("Missing OpenCV. Run:  pip install opencv-python")

# Reuse the wire protocol + port detection from the single-shot tool.
from capture import (
    HEADER_LEN,
    autodetect_port,
    parse_header,
    read_exact,
    sync_to_magic,
)
import struct
import color

CAPTURES_DIR = Path(__file__).resolve().parent.parent / "captures"
WINDOW = "Reweave camera preview"


def decode_rgb565(raw: bytes, w: int, h: int, byteswap: bool) -> np.ndarray:
    """Vectorized RGB565 -> BGR uint8 (BGR because that's what cv2 displays)."""
    arr = np.frombuffer(raw, dtype=np.uint8).astype(np.uint16)
    b0 = arr[0::2]
    b1 = arr[1::2]
    px = ((b1 << 8) | b0) if byteswap else ((b0 << 8) | b1)
    r = ((px >> 11) & 0x1F) * 255 // 31
    g = ((px >> 5) & 0x3F) * 255 // 63
    b = (px & 0x1F) * 255 // 31
    rgb = np.stack([r, g, b], axis=1).astype(np.uint8).reshape(h, w, 3)
    return rgb[:, :, ::-1].copy()  # -> BGR for cv2


def main():
    ap = argparse.ArgumentParser(description="Reweave live camera preview")
    ap.add_argument("--port", help="serial port (auto-detected if omitted)")
    ap.add_argument("--baud", type=int, default=115200)
    ap.add_argument("--timeout", type=float, default=10.0, help="per-frame read timeout")
    ap.add_argument("--upscale", type=int, default=3, help="on-screen zoom factor")
    args = ap.parse_args()

    port = args.port or autodetect_port()
    if not port:
        sys.exit("No serial port found. Plug in the board or pass --port.")

    byteswap = False
    zoom = max(1, args.upscale)
    correct_on = True
    gain = list(color.DEFAULT_GAIN)   # [B, G, R], live-adjustable

    print(f"Opening {port} ... (window opens after the board resets)")
    with serial.Serial(port, args.baud, timeout=0.2) as ser:
        time.sleep(2.0)            # board resets when the port opens
        ser.reset_input_buffer()

        cv2.namedWindow(WINDOW, cv2.WINDOW_NORMAL)
        last = time.time()
        fps = 0.0
        misses = 0

        while True:
            ser.reset_input_buffer()
            ser.write(b"c")
            ser.flush()
            deadline = time.time() + args.timeout
            try:
                sync_to_magic(ser, deadline)
                w, h, bpp, _sensor = parse_header(read_exact(ser, HEADER_LEN, deadline))
                raw = read_exact(ser, w * h * bpp, deadline)
            except (TimeoutError, struct.error):
                misses += 1
                if misses > 5:
                    print("Lost the board. Is the Serial Monitor open, or was it unplugged?")
                    break
                continue
            misses = 0

            raw_bgr = decode_rgb565(raw, w, h, byteswap)
            shown = color.correct(raw_bgr, gain=tuple(gain)) if correct_on else raw_bgr
            big = cv2.resize(shown, (w * zoom, h * zoom), interpolation=cv2.INTER_NEAREST)

            now = time.time()
            dt = now - last
            last = now
            if dt > 0:
                fps = 0.8 * fps + 0.2 * (1.0 / dt)
            gtxt = f"R{gain[2]:.2f} G{gain[1]:.2f} B{gain[0]:.2f}" if correct_on else "raw"
            overlay = f"{w}x{h}  {fps:4.1f} fps  x{zoom}  correct={'on' if correct_on else 'off'} [{gtxt}]"
            cv2.putText(big, overlay, (8, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 3)
            cv2.putText(big, overlay, (8, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
            help2 = "s=save c=correct 1-6=RGB gain g=print b=swap +/-=zoom q=quit"
            cv2.putText(big, help2, (8, big.shape[0] - 12),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.42, (0, 0, 0), 3)
            cv2.putText(big, help2, (8, big.shape[0] - 12),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.42, (255, 255, 255), 1)

            cv2.imshow(WINDOW, big)
            key = cv2.waitKey(1) & 0xFF
            step = 0.04
            if key in (ord("q"), 27):
                break
            elif key == ord("s"):
                CAPTURES_DIR.mkdir(exist_ok=True)
                stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                out = CAPTURES_DIR / f"preview_{stamp}.png"
                cv2.imwrite(str(out), shown)   # save what's on screen, native resolution
                print(f"Saved -> {out}")
            elif key == ord("c"):
                correct_on = not correct_on
            elif key == ord("g"):
                print(f"DEFAULT_GAIN = ({gain[0]:.2f}, {gain[1]:.2f}, {gain[2]:.2f})  # (B, G, R)")
            elif key == ord("1"):
                gain[2] = max(0.1, gain[2] - step)
            elif key == ord("2"):
                gain[2] = min(3.0, gain[2] + step)
            elif key == ord("3"):
                gain[1] = max(0.1, gain[1] - step)
            elif key == ord("4"):
                gain[1] = min(3.0, gain[1] + step)
            elif key == ord("5"):
                gain[0] = max(0.1, gain[0] - step)
            elif key == ord("6"):
                gain[0] = min(3.0, gain[0] + step)
            elif key == ord("b"):
                byteswap = not byteswap
            elif key in (ord("+"), ord("=")):
                zoom = min(8, zoom + 1)
            elif key in (ord("-"), ord("_")):
                zoom = max(1, zoom - 1)

            # If the user closed the window with the X button, stop.
            if cv2.getWindowProperty(WINDOW, cv2.WND_PROP_VISIBLE) < 1:
                break

    cv2.destroyAllWindows()
    print("Preview closed.")


if __name__ == "__main__":
    main()
