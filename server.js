import express from "express";
import fetch from "node-fetch";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(express.json());

// ✅ CORS 설정 (모든 도메인 허용)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*"); // 모든 도메인 허용
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200); // preflight 요청 바로 응답
  }
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
    if (!id || !svgUrl) {
      return res.status(400).json({ error: "id와 svgUrl이 필요합니다." });
    }

    // SVG 가져오기
    const svgBuffer = await fetch(svgUrl).then(r => r.arrayBuffer());
    const pngBuffer = await sharp(Buffer.from(svgBuffer)).png().toBuffer();

    // Supabase Storage 업로드
    const filePath = `cards/${id}.png`;
    const { error: uploadError } = await supabase.storage
      .from("guestbook")
      .upload(filePath, pngBuffer, { contentType: "image/png", upsert: true });

    if (uploadError) {
      return res.status(500).json({ error: uploadError.message });
    }

    // Public URL 가져오기
    const { data } = supabase.storage.from("guestbook").getPublicUrl(filePath);

    return res.json({ success: true, url: data.publicUrl });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// ✅ 서버 시작
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}...`));