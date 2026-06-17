/*
 * Reweave — Arduino camera feasibility test
 * Board:  Arduino Nano 33 BLE Sense (Tiny ML Kit)
 * Camera: OV7675 on the Tiny ML shield
 *
 * Goal: prove the Arduino can replace the iPhone as the capture device.
 * On every byte received over USB serial, it grabs ONE frame and streams
 * it back to the computer in a tiny framed binary protocol that the Python
 * bridge (bridge/capture.py) knows how to read.
 *
 * It also reads the onboard APDS-9960 IR/light sensor (proximity uses an IR
 * LED; color gives R/G/B/clear) and ships those values in the header. They feed
 * a tiny, low-confidence material hint on the computer side -- present in the
 * pipeline but weighted ~0.01%, so it never overrides the camera/CV result.
 *
 * Frame protocol (all little-endian):
 *   byte  0xAA            magic 1
 *   byte  0x55            magic 2
 *   u16   width
 *   u16   height
 *   u8    bytesPerPixel   (2 for RGB565)
 *   u8    irPresent       (1 if APDS-9960 was found, else 0)
 *   u16   sR              APDS red
 *   u16   sG              APDS green
 *   u16   sB              APDS blue
 *   u16   sClear          APDS clear (ambient/reflected intensity)
 *   u8    sProximity      IR-LED reflectance (0..255)
 *   ...   width*height*bytesPerPixel raw pixel bytes
 *
 * Setup in Arduino IDE:
 *   1. Boards Manager  -> install "Arduino Mbed OS Nano Boards"
 *   2. Library Manager -> install "Arduino_OV767X" and "Arduino_APDS9960"
 *   3. Select board "Arduino Nano 33 BLE", pick the port, Upload.
 *
 * If the board does NOT show up / hangs after upload, the QVGA buffer
 * (150 KB) was too big for RAM on your unit -- switch RESOLUTION to QQVGA
 * below (38 KB, rock solid) and re-upload.
 */

#include <Arduino_OV767X.h>
#include <Arduino_APDS9960.h>

// ---- Easy knob: image quality vs. reliability -------------------------------
// QVGA  = 320x240 (better for judging fabric type, ~150 KB buffer)
// QQVGA = 160x120 (bulletproof fallback, ~38 KB buffer)
#define RESOLUTION QVGA
// -----------------------------------------------------------------------------

int frameWidth;
int frameHeight;
int bytesPerPixel;
bool irPresent = false;

// Frame buffer. Sized for the largest case we use (QVGA RGB565 = 153600).
byte frameBuffer[320 * 240 * 2];

void writeU16(uint16_t v) {
  Serial.write((byte)(v & 0xFF));
  Serial.write((byte)((v >> 8) & 0xFF));
}

void setup() {
  Serial.begin(115200);          // baud is ignored on native USB; transfer is full-speed
  while (!Serial) { /* wait for the host to open the port */ }

  // The Tiny ML Kit ships the OV7675, which the Arduino_OV767X driver handles
  // via the standard 3-arg begin (resolution, format, fps).
  if (!Camera.begin(RESOLUTION, RGB565, 1)) {
    Serial.println("ERROR: camera init failed (check shield seating / library).");
    while (true) {}
  }

  frameWidth = Camera.width();
  frameHeight = Camera.height();
  bytesPerPixel = Camera.bytesPerPixel();

  // Onboard IR/light sensor. Optional -- if it isn't found we still send frames,
  // just with irPresent=0.
  irPresent = APDS.begin();
  if (irPresent) {
    // proximityAvailable()/colorAvailable() enable their engines internally;
    // kick them once so they're integrating before the first capture.
    APDS.proximityAvailable();
    APDS.colorAvailable();
    delay(60);
  }

  Serial.print("READY ");
  Serial.print(frameWidth);
  Serial.print("x");
  Serial.print(frameHeight);
  Serial.print(" bpp=");
  Serial.print(bytesPerPixel);
  Serial.print(" ir=");
  Serial.print(irPresent ? 1 : 0);
  Serial.println(" -- send any byte to capture");
}

void readSensor(uint16_t &r, uint16_t &g, uint16_t &b, uint16_t &c, uint8_t &prox) {
  r = g = b = c = 0;
  prox = 0;
  if (!irPresent) return;

  if (APDS.proximityAvailable()) {
    int p = APDS.readProximity();      // IR-LED reflectance, 0..255 (-1 if N/A)
    if (p >= 0) prox = (uint8_t)p;
  }

  unsigned long t0 = millis();
  while (!APDS.colorAvailable() && (millis() - t0) < 500) { delay(5); }
  if (APDS.colorAvailable()) {
    int ri, gi, bi, ci;
    if (APDS.readColor(ri, gi, bi, ci) && ri >= 0) {
      r = (uint16_t)ri; g = (uint16_t)gi; b = (uint16_t)bi; c = (uint16_t)ci;
    }
  }
}

void sendFrame() {
  uint16_t sR, sG, sB, sC;
  uint8_t sProx;
  readSensor(sR, sG, sB, sC, sProx);   // read sensor before grabbing the frame

  Camera.readFrame(frameBuffer);

  // Header
  Serial.write(0xAA);
  Serial.write(0x55);
  writeU16((uint16_t)frameWidth);
  writeU16((uint16_t)frameHeight);
  Serial.write((byte)bytesPerPixel);
  Serial.write((byte)(irPresent ? 1 : 0));
  writeU16(sR);
  writeU16(sG);
  writeU16(sB);
  writeU16(sC);
  Serial.write(sProx);

  // Pixels
  Serial.write(frameBuffer, (size_t)frameWidth * frameHeight * bytesPerPixel);
  Serial.flush();
}

void loop() {
  if (Serial.available() > 0) {
    while (Serial.available() > 0) { Serial.read(); }  // drain the trigger byte(s)
    sendFrame();
  }
}
