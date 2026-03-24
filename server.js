import express from "express";
import fetch from "node-fetch";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(express.json());

// ✅ CORS
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "https://tensorgitdev.github.io");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// ✅ Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ✅ PNG 변환 + 업로드 + DB 업데이트
app.post("/convert", async (req, res) => {
  try {
    const { id, svgUrl } = req.body;
    console.log("POST /convert", { id, svgUrl });

    // 1️⃣ SVG 가져오기
    const svgBuffer = await fetch(svgUrl).then(r => r.arrayBuffer());

    // 2️⃣ PNG 변환
    const pngBuffer = await sharp(Buffer.from(svgBuffer)).png().toBuffer();

    // 3️⃣ Storage 업로드
    const filePath = `cards/${id}.png`;
    const { error: uploadError } = await supabase.storage
      .from("guestbook")
      .upload(filePath, pngBuffer, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return res.status(500).json({ error: uploadError.message });
    }

    // 4️⃣ Public URL
    const { data } = supabase.storage
      .from("guestbook")
      .getPublicUrl(filePath);

    const pngUrl = data.publicUrl;
    console.log("PNG URL:", pngUrl);

    // 🔥 5️⃣ DB 업데이트 (핵심 추가)
    const { error: updateError } = await supabase
      .from("guestbook")
      .update({ gb_card_image_url: pngUrl })
      .eq("gb_id", id);

    if (updateError) {
      console.error("DB update error:", updateError);
      return res.status(500).json({ error: updateError.message });
    }

    return res.json({ success: true, url: pngUrl });

  } catch (err) {
    console.error("Internal Server Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// 서버 시작
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}...`));