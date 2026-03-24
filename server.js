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

// ✅ 트위터 카드용 og 태그 페이지
app.get("/view-card", async (req, res) => {
  const { id } = req.query;

  if (!id) return res.status(400).send("invalid id");

  const { data, error } = await supabase
    .from("guestbook")
    .select("gb_card_image_url")
    .eq("gb_id", id)
    .single();

  if (error || !data) return res.status(404).send("not found");

  const imageUrl = data.gb_card_image_url;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.send(`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta property="og:title" content="ask me anything" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content="${imageUrl}" />
  <title>Ask Me Anything</title>
  <style>
    :root {
      --primary-color: #4f46e5;
      --hover-color: #4338ca;
      --bg-color: #f8fafc;
      --text-color: #1e293b;
    }

    body {
      margin: 0;
      background-color: var(--bg-color);
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, Roboto, sans-serif;
    }

    .btn-ask {
      background-color: var(--primary-color);
      color: white;
      border: none;
      padding: 12px 24px;
      font-size: 1rem;
      font-weight: 600;
      border-radius: 12px;
      cursor: pointer;
      width: 100%;
      transition: all 0.2s ease;
      box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);
    }

    .btn-ask:hover {
      background-color: var(--hover-color);
      box-shadow: 0 10px 15px -3px rgba(79, 70, 229, 0.3);
    }

    .btn-ask:active {
      transform: scale(0.98);
    }
  </style>
</head>
<body>

  <div class="container">
    <div class="image-wrapper">
      <img src="${imageUrl}" alt="Main Visual" />
    </div>
    <button class="btn-ask" onclick="location.href='https://tensorgitdev.github.io/index/';" aria-label="질문하기">
      Ask me anything
    </button>
  </div>

</body>
</html>`);
});

// 서버 시작
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}...`));