import express from "express";
import fetch from "node-fetch";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.post("/convert", async (req, res) => {
  try {
    const { id, svgUrl } = req.body;

    const svgBuffer = await fetch(svgUrl).then(r => r.arrayBuffer());
    const pngBuffer = await sharp(Buffer.from(svgBuffer)).png().toBuffer();

    const filePath = `cards/${id}.png`;
    const { error } = await supabase.storage
      .from("guestbook")
      .upload(filePath, pngBuffer, { contentType: "image/png", upsert: true });

    if (error) return res.status(500).send(error.message);

    const { data } = supabase.storage.from("guestbook").getPublicUrl(filePath);
    res.json({ success: true, url: data.publicUrl });

  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.listen(process.env.PORT || 3000, () => console.log("Server running..."));