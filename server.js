import express from "express";
import fetch from "node-fetch";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(express.json());

// ✅ CORS 설정 (모든 도메인 허용)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "https://tensorgitdev.github.io"); // 또는 "*"
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(200); // preflight 응답
  next();
});

// ✅ Supabase 클라이언트
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ✅ PNG 변환 API

app.post("/convert", async (req, res) => {
  try {
    const { id, svgUrl } = req.body;
    console.log("POST /convert", { id, svgUrl });

    const svgBuffer = await fetch(svgUrl).then(r => r.arrayBuffer());
    console.log("Fetched SVG, length:", svgBuffer.byteLength);

    const pngBuffer = await sharp(Buffer.from(svgBuffer)).png().toBuffer();
    console.log("PNG buffer created, length:", pngBuffer.length);

    const filePath = `cards/${id}.png`;
    const { error: uploadError } = await supabase.storage
      .from("guestbook")
      .upload(filePath, pngBuffer, { contentType: "image/png", upsert: true });

    if (uploadError) {
      console.error("Supabase upload error:", uploadError);
      return res.status(500).json({ error: uploadError.message });
    }

    const { data } = supabase.storage.from("guestbook").getPublicUrl(filePath);
    console.log("Public URL:", data.publicUrl);

    return res.json({ success: true, url: data.publicUrl });
  } catch (err) {
    console.error("Internal Server Error:", err);
    return res.status(500).json({ error: err.message });
  }
});


// ✅ 서버 시작
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}...`));