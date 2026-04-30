// labourmatch-backend/src/controllers/workMedia.controller.js
const path = require("path"); // ✅ ADD
const prisma = require("../utils/prisma");
const BASE_URL = process.env.BASE_URL || "http://localhost:5000";

// ✅ Contractor ke saare work media fetch karo
async function getWorkMedia(req, res) {
  try {
    const { contractorId } = req.params;
    const media = await prisma.workMedia.findMany({
      where: { contractorId },
      orderBy: { createdAt: "desc" },
    });
    return res.json({ success: true, data: media });
  } catch (error) {
    console.error("getWorkMedia error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// ✅ Naya work media upload karo
async function uploadWorkMedia(req, res) {
  try {
    const { contractorId } = req.params;
    const { caption, projectName, type } = req.body;

    const contractor = await prisma.contractor.findUnique({ where: { id: contractorId } });
    if (!contractor) {
      return res.status(404).json({ success: false, message: "Contractor nahi mila" });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: "File upload karo" });
    }

    // ✅ FIXED: sirf filename use karo — double uploads/ nahi aayega
    const fileName = path.basename(req.file.path);
    const fileUrl = `${BASE_URL}/uploads/${fileName}`;

    const mediaType = type || (req.file.mimetype.startsWith("video") ? "video" : "image");

    const media = await prisma.workMedia.create({
      data: {
        contractorId,
        type: mediaType,
        url: fileUrl,
        thumbnail: mediaType === "video" ? null : fileUrl,
        caption: caption || null,
        projectName: projectName || null,
      },
    });

    return res.status(201).json({ success: true, data: media, message: "Media upload ho gayi!" });
  } catch (error) {
    console.error("uploadWorkMedia error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// ✅ Work media delete karo
async function deleteWorkMedia(req, res) {
  try {
    const { id } = req.params;
    await prisma.workMedia.delete({ where: { id } });
    return res.json({ success: true, message: "Media delete ho gayi!" });
  } catch (error) {
    console.error("deleteWorkMedia error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

module.exports = { getWorkMedia, uploadWorkMedia, deleteWorkMedia };