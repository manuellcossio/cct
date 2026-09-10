import { Router, type IRouter } from "express";
import crypto from "crypto";

const router: IRouter = Router();

function getExpectedToken(): string {
  const secret = process.env.SESSION_SECRET ?? "fallback-secret";
  return crypto.createHmac("sha256", secret).update("cct:auth:valid").digest("hex");
}

router.post("/pin", (req, res) => {
  const { pin } = req.body as { pin?: string };
  const expected = process.env.CCT_PIN;

  if (!pin || !expected) {
    return res.status(400).json({ ok: false });
  }

  let match = false;
  try {
    match = crypto.timingSafeEqual(Buffer.from(pin, "utf8"), Buffer.from(expected, "utf8"));
  } catch {
    match = false;
  }

  if (!match) {
    return res.status(401).json({ ok: false });
  }

  return res.json({ ok: true, token: getExpectedToken() });
});

router.get("/verify", (req, res) => {
  const token = req.headers["x-cct-token"] as string | undefined;
  if (!token) return res.status(401).json({ ok: false });

  const expected = getExpectedToken();
  let valid = false;
  try {
    valid = crypto.timingSafeEqual(Buffer.from(token, "hex"), Buffer.from(expected, "hex"));
  } catch {
    valid = false;
  }

  return res.json({ ok: valid });
});

export default router;
