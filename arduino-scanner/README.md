# Reweave — Arduino Camera Feasibility Test

Goal of this folder: **prove the Arduino can replace the iPhone as the capture
device** before we invest in a stand or wireless. The Arduino just takes the
photo and ships it to the computer; the real Reweave CV pipeline runs unchanged
on the backend.

```
Arduino (OV7675) --USB serial--> bridge/capture.py --> PNG --> POST /api/vision/detect
```

What we're testing:
1. Can we get a frame off the board at all?
2. Is the image good enough to read **color** and **fabric type**?
3. Does the existing pipeline accept it like a normal upload?

---

## Folder contents

| Path | What it is |
|------|------------|
| `arduino/reweave_capture/reweave_capture.ino` | Firmware: capture one frame, stream it over serial |
| `bridge/capture.py` | Python: trigger, receive, decode to PNG, optional pipeline POST |
| `bridge/preview.py` | Live preview window for aiming / focus / lighting + live color tuning |
| `bridge/color.py` | Color correction (the OV7675 has a green bias; this fixes it) |
| `bridge/ir.py` | IR/reflectance material hint from the onboard APDS-9960 (0.01% weight) |
| `bridge/requirements.txt` | `pyserial`, `Pillow`, `requests` |
| `captures/` | Saved PNGs land here |

---

## One-time setup

### 1. Flash the Arduino
1. Open the Arduino IDE.
2. **Boards Manager** → install **"Arduino Mbed OS Nano Boards"**.
3. **Library Manager** → install **"Arduino_OV767X"**.
4. Open `arduino/reweave_capture/reweave_capture.ino`.
5. Select board **Arduino Nano 33 BLE**, pick the port, click **Upload**.

> If the board hangs or disappears after upload, the QVGA buffer was too big
> for RAM on your unit. Change `#define RESOLUTION QVGA` to `QQVGA` near the top
> of the sketch and re-upload. (Lower quality, but bulletproof.)

### 2. Python bridge
```bash
cd arduino-scanner/bridge
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

---

## Run the test

**Just capture a photo:**
```bash
python capture.py
```
Then open the newest file in `../captures/` and answer the only question that
matters: *can you tell the fabric color and roughly the type?*

**Capture + run the real pipeline** (start the backend on :8000 first):
```bash
python capture.py --post
```
This prints how many pieces/color groups the CV found — the same result the
web Capture page would show.

**Useful flags:**
```bash
python capture.py --port /dev/cu.usbmodemXXXX   # skip auto-detect
python capture.py --byteswap                    # if colors look swapped
python capture.py --upscale 3                   # bigger PNG to eyeball detail
```

---

## Color correction (important)

The OV7675 has a strong **green bias and weak red**, so raw frames make skin and
warm fabrics look green/purple. `color.py` fixes this with a calibrated
per-channel gain (default `(B,G,R) = (0.98, 0.78, 1.28)`) plus denoise. It runs
automatically in both `capture.py` and `preview.py`.

- `capture.py --raw` saves the uncorrected sensor colors (for comparison).
- In `preview.py`, tune the gains live against your actual fabric:
  `1/2` = Red −/+, `3/4` = Green −/+, `5/6` = Blue −/+, `c` toggles correction
  on/off, `g` prints the current gains. When a setting looks right, paste it into
  `DEFAULT_GAIN` at the top of `color.py`.

Color accuracy depends on lighting, so re-tune under the lighting you'll demo in.

## IR / reflectance sensing (low-weight, "we have it" feature)

The sketch also reads the board's onboard **APDS-9960** sensor — proximity (an
**IR-LED reflectance** reading) plus RGB+clear color — and ships it in each
frame's header. `ir.py` turns it into a coarse synthetic-vs-natural hint and
blends it into the classification at **0.01% weight**, so it's genuinely present
in the pipeline but never changes the camera/CV result. Every capture writes a
sidecar `capture_*.json` with the raw sensor values and the hint.

Important: the IR proximity is **short range** — it only registers an object
within a few centimeters. Pointed at a far wall it reads `0` (correct, not a
bug). **Hold a fabric scrap right up to the board** and the reflectance reading
moves. Run `capture.py --post` to see the 0.01% blend line printed alongside the
pipeline result.

This is intentionally coarse — a single IR band can't identify fiber content
(that needs NIR spectroscopy), which is exactly why it carries ~0 weight.

## Reading the result

- **Image is clear enough to see color + weave** → feasibility ✅, move on to the
  physical stand. Lighting and a fixed downward mount will improve it further.
- **Color OK but texture/type unreadable** → expected for QVGA. Try better
  lighting, fill the frame with fabric, and `--upscale`. Fabric *type* is hard
  even from a phone; if color sorting works, that's already a win.
- **Garbled / wrong colors** → add `--byteswap`. Still bad → drop to QQVGA in the
  sketch and confirm the basic path works first.
- **Nothing arrives** → check the port (`python -m serial.tools.list_ports -v`),
  make sure the Serial Monitor in the Arduino IDE is **closed** (it holds the
  port), and that the sketch uploaded.

---

## What this is NOT

No CV runs on the Arduino — it's purely the camera. Wireless (BLE) is a separate,
harder step we only attempt if the wired image quality clears the bar above.
