
"use strict";

/**
 * Telegram Powerful Help Bot — All-in-One index.js
 * -------------------------------------------------
 * Included systems (1 to 24):
 * 1) Basic System
 * 2) Menu & UI System
 * 3) FAQ / Auto Reply System
 * 4) Support Ticket System
 * 5) Admin Panel System
 * 6) Broadcast System
 * 7) Force Join System
 * 8) User Management
 * 9) Group Management
 * 10) Owner Approval System
 * 11) Content Save / Fetch System
 * 12) File / Media Tools
 * 13) Useful Tools Section
 * 14) Search System
 * 15) Command Management
 * 16) Logging System
 * 17) Database System
 * 18) Security & Protection
 * 19) Settings System
 * 20) Extra Premium Features (core-ready scaffold)
 * 21) Language System
 * 22) Filter System
 * 23) Clean Services System
 * 24) Approval Mode Toggle System
 *
 * Notes:
 * - This is a structured production-style single-file bot.
 * - Advanced items like scheduled broadcast / backup-restore / dashboard-ready hooks
 *   are included as working scaffolds or core handlers ready to expand.
 * - Uses polling by default. You can adapt to webhook later.
 */

require("dotenv").config();
const { Telegraf, Markup, session } = require("telegraf");
const mongoose = require("mongoose");
const crypto = require("crypto");
const sharp = require("sharp");

// ======================= ENV =======================
const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGODB_URI = process.env.MONGODB_URI;
const OWNER_ID = Number(process.env.OWNER_ID || 0);
const BOT_USERNAME = String(process.env.BOT_USERNAME || "").replace(/^@/, "");
const TZ = process.env.TZ || "Asia/Yangon";

if (!BOT_TOKEN) throw new Error("Missing BOT_TOKEN in .env");
if (!MONGODB_URI) throw new Error("Missing MONGODB_URI in .env");
if (!OWNER_ID || !Number.isFinite(OWNER_ID)) throw new Error("Missing valid OWNER_ID in .env");

// ======================= INIT =======================
const bot = new Telegraf(BOT_TOKEN);
bot.use(session());

mongoose.set("strictQuery", true);
mongoose.connect(MONGODB_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB error:", err);
    process.exit(1);
  });

// ======================= HELPERS =======================
const now = () => new Date();
const toText = (v) => String(v || "").trim();
const isPrivate = (ctx) => ctx.chat?.type === "private";
const isGroup = (ctx) => ["group", "supergroup"].includes(ctx.chat?.type);
const escapeHtml = (s) => String(s || "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;");

function formatDate(date) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: TZ,
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(date));
  } catch {
    return new Date(date).toISOString();
  }
}

function ticketId() {
  return "TCK-" + crypto.randomBytes(3).toString("hex").toUpperCase();
}

function referralCode(userId) {
  return "REF" + String(userId).slice(-6);
}

function splitArgs(text) {
  const raw = toText(text);
  const parts = raw.split(/\s+/);
  return { cmd: (parts.shift() || "").toLowerCase(), args: parts };
}

function onOff(v) {
  const x = String(v || "").toLowerCase();
  return ["on", "true", "1", "yes", "enable", "enabled"].includes(x);
}

function cleanCmd(text, name) {
  return toText(text).replace(new RegExp(`^/${name}(?:@${BOT_USERNAME})?`, "i"), "").trim();
}

function choose(arr) {
  if (!arr.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}



async function getUserAvatarBuffer(userId) {
  try {
    const photos = await bot.telegram.getUserProfilePhotos(userId, 0, 1);
    if (!photos?.total_count || !photos.photos?.[0]?.length) return null;
    const fileId = photos.photos[0][photos.photos[0].length - 1].file_id;
    const link = await bot.telegram.getFileLink(fileId);
    const res = await fetch(String(link));
    if (!res.ok) return null;
    const arr = await res.arrayBuffer();
    return Buffer.from(arr);
  } catch {
    return null;
  }
}

async function buildWelcomeImage(fullName, groupName, avatarBuffer = null) {
  const fs = require("fs");
  const os = require("os");
  const path = require("path");
  const { execFile } = require("child_process");

  function execFileAsync(cmd, args) {
    return new Promise((resolve, reject) => {
      execFile(cmd, args, (err, stdout, stderr) => {
        if (err) return reject(new Error(stderr || err.message || String(err)));
        resolve({ stdout, stderr });
      });
    });
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "welcome-"));
  const templateFile = path.join(process.cwd(), "assets", "welcome_template.png");

  const baseFile = path.join(tmpDir, "base.png");
  const overlayFile = path.join(tmpDir, "overlay.png");
  const titleShadow = path.join(tmpDir, "title_shadow.png");
  const titleGlow = path.join(tmpDir, "title_glow.png");
  const titleText = path.join(tmpDir, "title_text.png");
  const nameFile = path.join(tmpDir, "name.png");
  const groupFile = path.join(tmpDir, "group.png");
  const lineFile = path.join(tmpDir, "line.png");
  const footerFile = path.join(tmpDir, "footer.png");
  const outFile = path.join(tmpDir, "welcome.png");

  const avatarSrc = path.join(tmpDir, "avatar_src.png");
  const avatarMask = path.join(tmpDir, "avatar_mask.png");
  const avatarCircle = path.join(tmpDir, "avatar_circle.png");
  const avatarShadow = path.join(tmpDir, "avatar_shadow.png");

  const safeFull = String(fullName || "User").replace(/'/g, "’");
  const safeGroup = String(groupName || "Group").replace(/'/g, "’");

  if (!fs.existsSync(templateFile)) {
    throw new Error("Missing assets/welcome_template.png");
  }

  await execFileAsync("convert", [
    templateFile,
    "-resize", "1280x720!",
    baseFile
  ]);

  await execFileAsync("convert", [
    "-size", "1280x720",
    "xc:none",
    "-fill", "#03101c40",
    "-draw", "roundrectangle 370,205 1125,520 24,24",
    overlayFile
  ]);

  await execFileAsync("convert", [
    "-size", "900x160",
    "xc:none",
    "-font", "DejaVu-Serif",
    "-pointsize", "92",
    "-fill", "#00000099",
    "-gravity", "center",
    "-annotate", "+0+0", "WELCOME",
    "-blur", "0x2",
    titleShadow
  ]);

  await execFileAsync("convert", [
    "-size", "900x160",
    "xc:none",
    "-font", "DejaVu-Serif",
    "-pointsize", "92",
    "-fill", "#f2d27b",
    "-gravity", "center",
    "-annotate", "+0+0", "WELCOME",
    "-blur", "0x4",
    titleGlow
  ]);

  await execFileAsync("convert", [
    "-background", "none",
    "-fill", "#ffd86a",
    "-font", "DejaVu-Serif",
    "-pointsize", "92",
    "label:WELCOME",
    titleText
  ]);

  await execFileAsync("pango-view", [
    "--no-display",
    "--font=Padauk Bold 42",
    "--foreground=#ffffff",
    "--background=transparent",
    "--align=left",
    "--pixels",
    "--margin=0",
    "--output", nameFile,
    "--text", `မင်္ဂလာပါ ${safeFull}`
  ]);

  await execFileAsync("pango-view", [
    "--no-display",
    "--font=Padauk Bold 38",
    "--foreground=#f2d27b",
    "--background=transparent",
    "--align=left",
    "--pixels",
    "--margin=0",
    "--output", groupFile,
    "--text", `${safeGroup} မှ`
  ]);

  await execFileAsync("pango-view", [
    "--no-display",
    "--font=Padauk 36",
    "--foreground=#eef4ff",
    "--background=transparent",
    "--align=left",
    "--pixels",
    "--margin=0",
    "--output", lineFile,
    "--text", "လှိုက်လှဲစွာ ကြိုဆိုပါတယ်ဗျ"
  ]);

  await execFileAsync("convert", [
    "-background", "none",
    "-fill", "#cddaf4",
    "-font", "DejaVu-Sans",
    "-pointsize", "17",
    "label:Bika Powerful Help Bot Welcome Card",
    footerFile
  ]);

  await execFileAsync("convert", [
    baseFile,
    overlayFile, "-composite",
    titleText, "-gravity", "north", "-geometry", "+0+40", "-composite",
    nameFile, "-gravity", "northwest", "-geometry", "+520+282", "-composite",
    groupFile, "-gravity", "northwest", "-geometry", "+520+348", "-composite",
    lineFile, "-gravity", "northwest", "-geometry", "+520+416", "-composite",
    footerFile, "-gravity", "south", "-geometry", "+0+10", "-composite",
    outFile
  ]);

  if (avatarBuffer) {
    fs.writeFileSync(avatarSrc, avatarBuffer);

    await execFileAsync("convert", [
      avatarSrc,
      "-resize", "248x248^",
      "-gravity", "center",
      "-extent", "248x248",
      avatarSrc
    ]);

    await execFileAsync("convert", [
      "-size", "248x248",
      "xc:none",
      "-fill", "white",
      "-draw", "circle 124,124 124,10",
      avatarMask
    ]);

    await execFileAsync("convert", [
      avatarSrc,
      avatarMask,
      "-alpha", "off",
      "-compose", "copy_opacity",
      "-composite",
      avatarCircle
    ]);

    await execFileAsync("convert", [
      "-size", "310x310",
      "xc:none",
      "-fill", "#f2d27b55",
      "-draw", "circle 155,155 155,22",
      "-blur", "0x5",
      avatarShadow
    ]);

    await execFileAsync("convert", [
      outFile,
      avatarShadow, "-gravity", "west", "-geometry", "+52+34", "-composite",
      avatarCircle, "-gravity", "west", "-geometry", "+88+38", "-composite",
      outFile
    ]);
  }

  const buf = fs.readFileSync(outFile);
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  return buf;
}

function buildDefaultWelcomeText(fullName, mentionHtml, groupTitle) {
  return `မင်္ဂလာပါ ${mentionHtml} ရေ

${escapeHtml(groupTitle || "ဒီ Group")} မှ ကြိုဆိုပါတယ်

အချင်းချင်း စကားတွေပြောရင်း

ပျော်ရွှင်စရာနေ့ရက်တွေ ပိုင်ဆိုင်နိူင်ပါစေ`;
}

function safeEvalMath(expr) {
  if (!/^[0-9+\-*/(). %]+$/.test(expr)) throw new Error("Invalid chars");
  // eslint-disable-next-line no-new-func
  return Function(`"use strict"; return (${expr})`)();
}

// ======================= TEXTS =======================
const TEXTS = {
  my: {
    start: (name) => `မင်္ဂလာပါ ${escapeHtml(name)} 👋

ဒီ bot က Powerful Help Bot ဖြစ်ပြီး FAQ, Search, Support Tickets, Saved Contents, Filters, Clean Services, Admin System, Multi-Language, Tools စတဲ့ system တွေအများကြီး ပါဝင်ပါတယ်။`,
    help: `အသုံးပြုနိုင်တဲ့ အဓိက system များ

• FAQ
• Search
• Support Ticket
• Saved Content
• Filter System
• Clean Services
• Language Switch
• Admin / Owner Panel
• Utility Tools`,
    about: `Telegram Powerful Help Bot
All-in-one MongoDB + Telegraf structure
Language: Myanmar / English
Default: Myanmar`,
    needPrivate: `ဒီ command ကို private chat မှာ သုံးပါ။`,
    onlyGroup: `ဒီ command ကို group ထဲမှာပဲ သုံးလို့ရပါတယ်။`,
    noPerm: `ဒီ action အတွက် permission မရှိပါ။`,
    banned: `သင့် account ကို bot မှာ ban လုပ်ထားပါတယ်။`,
    maintenance: `Bot ကို maintenance mode ထားထားပါတယ်။ နောက်မှပြန်စမ်းကြည့်ပါ။`,
    pending: `ဒီ group ကို owner approval မရသေးပါ။`,
    forceJoin: `Bot ကိုသုံးရန် အောက်က channel တွေကို join ဝင်ရန်လိုအပ်ပါတယ်။`,
    faqNone: `FAQ မရှိသေးပါ။`,
    noResult: `ရှာမတွေ့ပါ။`,
    done: `လုပ်ဆောင်ပြီးပါပြီ။`,
    invalid: `Format မှားနေပါတယ်။`,
    ticketAsk: `Ticket အတွက် မေးခွန်း/ပြဿနာကို နောက် message မှာ ပို့ပါ။`,
    ticketCreated: (id) => `Support Ticket ဖွင့်ပြီးပါပြီ။
Ticket ID: ${id}`,
    ticketClosed: `Ticket ပိတ်ပြီးပါပြီ။`,
    langMy: `ဘာသာစကားကို မြန်မာသို့ ပြောင်းပြီးပါပြီ။`,
    langEn: `Language changed to English.`,
  },
  en: {
    start: (name) => `Hello ${escapeHtml(name)} 👋

This is a Powerful Help Bot with FAQ, Search, Support Tickets, Saved Contents, Filters, Clean Services, Admin System, Multi-Language, and useful tools.`,
    help: `Main systems available

• FAQ
• Search
• Support Ticket
• Saved Content
• Filter System
• Clean Services
• Language Switch
• Admin / Owner Panel
• Utility Tools`,
    about: `Telegram Powerful Help Bot
All-in-one MongoDB + Telegraf structure
Language: Myanmar / English
Default: Myanmar`,
    needPrivate: `Use this command in private chat.`,
    onlyGroup: `Use this command in a group.`,
    noPerm: `You do not have permission for this action.`,
    banned: `Your account is banned from this bot.`,
    maintenance: `Bot is under maintenance. Please try again later.`,
    pending: `This group is waiting for owner approval.`,
    forceJoin: `You must join the required channels below to use this bot.`,
    faqNone: `No FAQ found.`,
    noResult: `No results found.`,
    done: `Done.`,
    invalid: `Invalid format.`,
    ticketAsk: `Send your issue/question in your next message for the ticket.`,
    ticketCreated: (id) => `Support ticket created.
Ticket ID: ${id}`,
    ticketClosed: `Ticket closed.`,
    langMy: `ဘာသာစကားကို မြန်မာသို့ ပြောင်းပြီးပါပြီ။`,
    langEn: `Language changed to English.`,
  },
};

function t(lang, key, ...args) {
  const pack = TEXTS[lang] || TEXTS.my;
  const value = pack[key];
  return typeof value === "function" ? value(...args) : (value || key);
}

function mainMenu(lang = "my") {
  if (lang === "en") {
    return Markup.inlineKeyboard([
      [Markup.button.callback("❓ Help", "menu:help"), Markup.button.callback("📚 FAQ", "menu:faq")],
      [Markup.button.callback("🔎 Search", "menu:search"), Markup.button.callback("🎫 Support", "menu:support")],
      [Markup.button.callback("🧰 Tools", "menu:tools"), Markup.button.callback("🗂 Saved", "menu:saved")],
      [Markup.button.callback("🌐 Language", "menu:lang"), Markup.button.callback("ℹ️ About", "menu:about")],
      [Markup.button.callback("📞 Contact Admin", "menu:contact")],
    ]);
  }
  return Markup.inlineKeyboard([
    [Markup.button.callback("❓ အကူအညီ", "menu:help"), Markup.button.callback("📚 FAQ", "menu:faq")],
    [Markup.button.callback("🔎 ရှာဖွေရန်", "menu:search"), Markup.button.callback("🎫 ဆက်သွယ်ရန်", "menu:support")],
    [Markup.button.callback("🧰 Tools", "menu:tools"), Markup.button.callback("🗂 Saved", "menu:saved")],
    [Markup.button.callback("🌐 ဘာသာစကား", "menu:lang"), Markup.button.callback("ℹ️ အကြောင်း", "menu:about")],
    [Markup.button.callback("📞 Admin ဆက်သွယ်ရန်", "menu:contact")],
  ]);
}

function backButtons(lang = "my", target = "menu:main") {
  return Markup.inlineKeyboard([
    [Markup.button.callback(lang === "en" ? "⬅️ Back" : "⬅️ နောက်သို့", target), Markup.button.callback(lang === "en" ? "❌ Close" : "❌ ပိတ်မည်", "menu:close")],
  ]);
}

// ======================= SCHEMAS =======================
const userSchema = new mongoose.Schema({
  userId: { type: Number, unique: true, index: true },
  firstName: String,
  lastName: String,
  username: String,
  language: { type: String, default: "my" },
  isBanned: { type: Boolean, default: false },
  warnCount: { type: Number, default: 0 },
  role: { type: String, default: "user" }, // user/admin/owner
  referredBy: { type: Number, default: null },
  refCode: String,
  totalTickets: { type: Number, default: 0 },
  totalUses: { type: Number, default: 0 },
  joinedAt: { type: Date, default: now },
  lastSeenAt: { type: Date, default: now },
}, { timestamps: true });

const groupSchema = new mongoose.Schema({
  groupId: { type: Number, unique: true, index: true },
  title: String,
  username: String,
  inviteLink: String,
  status: { type: String, default: "approved" }, // approved/pending/rejected
  isBlacklisted: { type: Boolean, default: false },
  isEnabled: { type: Boolean, default: true },
  approvedAt: Date,
  approvedBy: Number,
  joinedAt: { type: Date, default: now },
  lastActiveAt: { type: Date, default: now },
  settings: {
    welcomeEnabled: { type: Boolean, default: true },
    welcomePhotoEnabled: { type: Boolean, default: true },
    welcomeTextEnabled: { type: Boolean, default: true },
    welcomeTextMy: { type: String, default: "" },
    welcomeTextEn: { type: String, default: "" },
    rulesText: { type: String, default: "" },
    filtersEnabled: { type: Boolean, default: true },
    cleanServicesEnabled: { type: Boolean, default: false },
    cleanJoin: { type: Boolean, default: true },
    cleanLeave: { type: Boolean, default: true },
    cleanPin: { type: Boolean, default: true },
    cleanVoice: { type: Boolean, default: true },
    cleanTitle: { type: Boolean, default: true },
    cleanPhoto: { type: Boolean, default: true },
    cleanOtherService: { type: Boolean, default: true },
    welcomeEnabled: { type: Boolean, default: true },
    welcomePhotoEnabled: { type: Boolean, default: true },
    welcomeTextEnabled: { type: Boolean, default: true },
  },
}, { timestamps: true });

const adminSchema = new mongoose.Schema({
  userId: { type: Number, unique: true, index: true },
  name: String,
  username: String,
  role: { type: String, default: "admin" },
  permissions: { type: [String], default: [] },
  addedBy: Number,
  active: { type: Boolean, default: true },
}, { timestamps: true });

const settingSchema = new mongoose.Schema({
  botName: { type: String, default: "Powerful Help Bot" },
  defaultLanguage: { type: String, default: "my" },
  maintenanceMode: { type: Boolean, default: false },
  approvalRequired: { type: Boolean, default: true }, // #24 approval mode toggle
  autoReplyEnabled: { type: Boolean, default: true },
  ticketEnabled: { type: Boolean, default: true },
  broadcastEnabled: { type: Boolean, default: true },
  forceJoinEnabled: { type: Boolean, default: false },
  forceJoinChannels: { type: [String], default: [] },
  globalFilterEnabled: { type: Boolean, default: true },
  supportTextMy: { type: String, default: "လိုအပ်ပါက /ticket ဖြင့် ဆက်သွယ်နိုင်ပါတယ်။" },
  supportTextEn: { type: String, default: "You can contact support using /ticket." },
  welcomeTextMy: { type: String, default: "မင်္ဂလာပါ။" },
  welcomeTextEn: { type: String, default: "Hello." },
  referralEnabled: { type: Boolean, default: true },
  feedbackEnabled: { type: Boolean, default: true },
}, { timestamps: true });

const faqSchema = new mongoose.Schema({
  question_my: String,
  question_en: String,
  answer_my: String,
  answer_en: String,
  keywords: { type: [String], default: [] },
  category: { type: String, default: "general" },
  matchMode: { type: String, default: "partial" }, // exact/partial
  status: { type: String, default: "active" },
  createdBy: Number,
  updatedBy: Number,
}, { timestamps: true });

const ticketSchema = new mongoose.Schema({
  ticketId: { type: String, unique: true, index: true },
  userId: Number,
  username: String,
  language: { type: String, default: "my" },
  subject: String,
  status: { type: String, default: "open" }, // open/pending/closed/reopened
  assignedAdmin: { type: Number, default: null },
  messages: [{
    senderId: Number,
    senderRole: String,
    text: String,
    createdAt: { type: Date, default: now },
  }],
  closedAt: Date,
}, { timestamps: true });

const savedSchema = new mongoose.Schema({
  keyword: { type: String, index: true },
  category: { type: String, default: "general" },
  type: { type: String, default: "text" }, // text/photo/video/document/link
  text: String,
  fileId: String,
  caption_my: String,
  caption_en: String,
  createdBy: Number,
  updatedBy: Number,
}, { timestamps: true });

const filterSchema = new mongoose.Schema({
  scope: { type: String, default: "group" }, // group/global
  groupId: { type: Number, default: null },
  pattern: String,
  matchType: { type: String, default: "partial" }, // exact/partial
  actionType: { type: String, default: "delete_warn" }, // delete/warn/delete_warn/delete_log
  enabled: { type: Boolean, default: true },
  createdBy: Number,
}, { timestamps: true });

const logSchema = new mongoose.Schema({
  type: String,
  actorId: Number,
  actorName: String,
  action: String,
  details: String,
  targetId: String,
  targetType: String,
  chatId: Number,
  timestamp: { type: Date, default: now },
}, { timestamps: false });

const broadcastSchema = new mongoose.Schema({
  type: String,
  targetMode: String, // users/groups/all
  totalTargets: Number,
  successCount: Number,
  failCount: Number,
  startedBy: Number,
  status: String,
  sourceMessageId: Number,
  sourceChatId: Number,
  startedAt: { type: Date, default: now },
  endedAt: Date,
}, { timestamps: true });

const warnSchema = new mongoose.Schema({
  userId: Number,
  groupId: Number,
  count: { type: Number, default: 0 },
  lastReason: String,
  updatedBy: Number,
}, { timestamps: true });

const customCommandSchema = new mongoose.Schema({
  command: { type: String, unique: true, index: true },
  type: { type: String, default: "text" },
  response_my: String,
  response_en: String,
  fileId: String,
  visibility: { type: String, default: "public" },
  createdBy: Number,
}, { timestamps: true });

const feedbackSchema = new mongoose.Schema({
  userId: Number,
  rating: Number,
  text: String,
}, { timestamps: true });

const referralSchema = new mongoose.Schema({
  userId: Number,
  code: String,
  invitedCount: { type: Number, default: 0 },
}, { timestamps: true });

const User = mongoose.model("User", userSchema);
const Group = mongoose.model("Group", groupSchema);
const Admin = mongoose.model("Admin", adminSchema);
const Setting = mongoose.model("Setting", settingSchema);
const FAQ = mongoose.model("FAQ", faqSchema);
const Ticket = mongoose.model("Ticket", ticketSchema);
const SavedContent = mongoose.model("SavedContent", savedSchema);
const Filter = mongoose.model("Filter", filterSchema);
const Log = mongoose.model("Log", logSchema);
const Broadcast = mongoose.model("Broadcast", broadcastSchema);
const Warn = mongoose.model("Warn", warnSchema);
const CustomCommand = mongoose.model("CustomCommand", customCommandSchema);
const Feedback = mongoose.model("Feedback", feedbackSchema);
const Referral = mongoose.model("Referral", referralSchema);

// ======================= DB HELPERS =======================
async function getSettings() {
  let s = await Setting.findOne();
  if (!s) s = await Setting.create({});
  return s;
}

async function ensureUser(from) {
  if (!from?.id) return null;
  const settings = await getSettings();
  const user = await User.findOneAndUpdate(
    { userId: from.id },
    {
      $set: {
        firstName: from.first_name || "",
        lastName: from.last_name || "",
        username: from.username || "",
        lastSeenAt: now(),
      },
      $setOnInsert: {
        language: settings.defaultLanguage || "my",
        refCode: referralCode(from.id),
        joinedAt: now(),
        role: from.id === OWNER_ID ? "owner" : "user",
      },
      $inc: { totalUses: 1 },
    },
    { upsert: true, new: true }
  );
  if (!await Referral.findOne({ userId: from.id })) {
    await Referral.create({ userId: from.id, code: user.refCode });
  }
  return user;
}

async function ensureGroup(chat) {
  if (!chat?.id || !["group", "supergroup"].includes(chat.type)) return null;
  const settings = await getSettings();
  let group = await Group.findOne({ groupId: chat.id });
  if (!group) {
    const status = settings.approvalRequired ? "pending" : "approved";
    group = await Group.create({
      groupId: chat.id,
      title: chat.title || "",
      username: chat.username || "",
      status,
      approvedAt: status === "approved" ? now() : null,
      approvedBy: status === "approved" ? OWNER_ID : null,
    });
  } else {
    group.title = chat.title || group.title;
    group.username = chat.username || group.username;
    group.lastActiveAt = now();
    await group.save();
  }
  return group;
}

async function isOwner(userId) {
  return Number(userId) === OWNER_ID;
}

async function isAdmin(userId) {
  if (await isOwner(userId)) return true;
  return !!(await Admin.findOne({ userId, active: true }));
}

async function getLang(user) {
  const settings = await getSettings();
  return user?.language || settings.defaultLanguage || "my";
}

async function writeLog(type, actorId, actorName, action, details = "", targetId = "", targetType = "", chatId = 0) {
  try {
    await Log.create({
      type, actorId, actorName, action, details,
      targetId: String(targetId || ""),
      targetType, chatId, timestamp: now(),
    });
  } catch (err) {
    console.error("writeLog error:", err.message);
  }
}

async function accessGuard(ctx) {
  const user = await ensureUser(ctx.from);
  const lang = await getLang(user);
  const settings = await getSettings();

  if (user?.isBanned) {
    await ctx.reply(t(lang, "banned"));
    return { ok: false, user, lang, settings };
  }
  if (settings.maintenanceMode && !(await isOwner(ctx.from.id))) {
    await ctx.reply(t(lang, "maintenance"));
    return { ok: false, user, lang, settings };
  }
  return { ok: true, user, lang, settings };
}

async function groupGuard(ctx, lang, settings) {
  if (!isGroup(ctx)) return true;
  const group = await ensureGroup(ctx.chat);
  if (!group?.isEnabled || group?.isBlacklisted) return false;
  if (settings.approvalRequired && group.status !== "approved") {
    await ctx.reply(t(lang, "pending"));
    return false;
  }
  return true;
}

async function forceJoinGuard(ctx, lang, settings) {
  if (!settings.forceJoinEnabled) return true;
  if (await isOwner(ctx.from.id)) return true;
  if (await isAdmin(ctx.from.id)) return true;
  if (!settings.forceJoinChannels.length) return true;

  const missing = [];
  for (const ch of settings.forceJoinChannels) {
    try {
      const member = await bot.telegram.getChatMember(ch, ctx.from.id);
      const status = member?.status;
      if (!["creator", "administrator", "member"].includes(status)) missing.push(ch);
    } catch {
      missing.push(ch);
    }
  }
  if (!missing.length) return true;

  const rows = missing.map((ch) => [Markup.button.url(ch, `https://t.me/${String(ch).replace(/^@/, "")}`)]);
  rows.push([Markup.button.callback(lang === "en" ? "✅ I Joined" : "✅ Join ဝင်ပြီးပါပြီ", "menu:recheck_fjoin")]);
  await ctx.reply(t(lang, "forceJoin"), Markup.inlineKeyboard(rows));
  return false;
}

function patternMatch(text, pattern, mode = "partial") {
  const a = String(text || "").toLowerCase();
  const b = String(pattern || "").toLowerCase();
  if (!a || !b) return false;
  if (mode === "exact") return a === b || a.split(/\s+/).includes(b);
  return a.includes(b);
}

async function applyFilters(ctx) {
  if (!isGroup(ctx)) return false;
  if (!ctx.message?.text) return false;
  if (await isOwner(ctx.from.id)) return false;
  if (await isAdmin(ctx.from.id)) return false;

  const group = await Group.findOne({ groupId: ctx.chat.id });
  if (!group?.settings?.filtersEnabled) return false;

  const settings = await getSettings();
  const filters = [];
  if (settings.globalFilterEnabled) {
    const globals = await Filter.find({ scope: "global", enabled: true });
    filters.push(...globals);
  }
  const locals = await Filter.find({ scope: "group", groupId: ctx.chat.id, enabled: true });
  filters.push(...locals);

  const msgText = ctx.message.text || "";
  for (const f of filters) {
    if (!patternMatch(msgText, f.pattern, f.matchType)) continue;

    try { await ctx.deleteMessage(); } catch {}

    if (["warn", "delete_warn"].includes(f.actionType)) {
      const doc = await Warn.findOneAndUpdate(
        { userId: ctx.from.id, groupId: ctx.chat.id },
        { $inc: { count: 1 }, $set: { lastReason: f.pattern, updatedBy: ctx.from.id } },
        { upsert: true, new: true }
      );
      await User.updateOne({ userId: ctx.from.id }, { $set: { warnCount: doc.count } });
      try {
        await ctx.reply(`⚠️ ${ctx.from.first_name || "User"}, message blocked by filter.`);
      } catch {}
    }

    await writeLog("filter", ctx.from.id, ctx.from.first_name || "", "hit_filter", `${f.scope}:${f.pattern}`, ctx.from.id, "user", ctx.chat.id);
    return true;
  }
  return false;
}

async function cleanServices(ctx) {
  if (!isGroup(ctx) || !ctx.message) return;
  const group = await Group.findOne({ groupId: ctx.chat.id });
  if (!group?.settings?.cleanServicesEnabled) return;

  const m = ctx.message;
  const shouldDelete =
    (group.settings.cleanJoin && !!m.new_chat_members) ||
    (group.settings.cleanLeave && !!m.left_chat_member) ||
    (group.settings.cleanPin && !!m.pinned_message) ||
    (group.settings.cleanVoice && (m.video_chat_started || m.video_chat_ended || m.video_chat_scheduled || m.video_chat_participants_invited)) ||
    (group.settings.cleanTitle && !!m.new_chat_title) ||
    (group.settings.cleanPhoto && (m.new_chat_photo || m.delete_chat_photo)) ||
    (group.settings.cleanOtherService && (m.group_chat_created || m.supergroup_chat_created || m.channel_chat_created || m.migrate_from_chat_id || m.migrate_to_chat_id));

  if (shouldDelete) {
    try { await ctx.deleteMessage(); } catch {}
  }
}

function userToolsHelp(lang = "my") {
  return lang === "en"
    ? `Tools:
 /calc 1+2*3
 /mono text
 /bold text
 /underline text
 /spoiler text
 /reverse text
 /upper text
 /lower text
 /password
 /flip
 /choose a | b | c
 /time
 /extractlink text`
    : `Tools:
 /calc 1+2*3
 /mono text
 /bold text
 /underline text
 /spoiler text
 /reverse text
 /upper text
 /lower text
 /password
 /flip
 /choose a | b | c
 /time
 /extractlink text`;
}

// ======================= MIDDLEWARE =======================
bot.use(async (ctx, next) => {
  try {
    if (ctx.from) await ensureUser(ctx.from);
    if (isGroup(ctx)) await ensureGroup(ctx.chat);
    if (ctx.message) {
      await cleanServices(ctx);
      const blocked = await applyFilters(ctx);
      if (blocked) return;
    }
    return next();
  } catch (err) {
    console.error("middleware error:", err);
    try { await ctx.reply("Internal error."); } catch {}
  }
});

// ======================= START / HELP / ABOUT =======================
bot.start(async (ctx) => {
  const access = await accessGuard(ctx);
  if (!access.ok) return;
  const { user, lang, settings } = access;

  if (!(await forceJoinGuard(ctx, lang, settings))) return;

  const payload = toText(ctx.startPayload || "");
  if (payload.startsWith("ref_")) {
    const inviter = Number(payload.replace(/^ref_/, ""));
    if (inviter && inviter !== ctx.from.id && !user.referredBy) {
      user.referredBy = inviter;
      await user.save();
      await Referral.findOneAndUpdate({ userId: inviter }, { $inc: { invitedCount: 1 } }, { upsert: true });
    }
  }

  await ctx.replyWithHTML(t(lang, "start", ctx.from.first_name || "User"), mainMenu(lang));
  await writeLog("user", ctx.from.id, ctx.from.first_name || "", "start", "", ctx.from.id, "user", ctx.chat.id);
});

bot.command("help", async (ctx) => {
  const access = await accessGuard(ctx);
  if (!access.ok) return;
  await ctx.reply(access.lang === "en" ? t(access.lang, "help") + "\n\n" + userToolsHelp("en") : t(access.lang, "help") + "\n\n" + userToolsHelp("my"), backButtons(access.lang));
});

bot.command("about", async (ctx) => {
  const access = await accessGuard(ctx);
  if (!access.ok) return;
  await ctx.reply(t(access.lang, "about"), backButtons(access.lang));
});

bot.command("ping", async (ctx) => {
  const start = Date.now();
  const msg = await ctx.reply("Pinging...");
  const ms = Date.now() - start;
  await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `🏓 Pong! ${ms} ms`);
});

bot.command("uptime", async (ctx) => {
  const s = Math.floor(process.uptime());
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  await ctx.reply(`⏱ Uptime: ${h}h ${m}m ${sec}s`);
});

// ======================= LANGUAGE =======================
bot.command("lang", async (ctx) => {
  const access = await accessGuard(ctx);
  if (!access.ok) return;
  const { user } = access;
  const { args } = splitArgs(ctx.message.text);
  const choice = (args[0] || "").toLowerCase();
  if (!["my", "en"].includes(choice)) return ctx.reply("Usage:\n/lang my\n/lang en");
  user.language = choice;
  await user.save();
  await ctx.reply(choice === "my" ? TEXTS.my.langMy : TEXTS.en.langEn, mainMenu(choice));
});

// ======================= INFO =======================
bot.command("id", async (ctx) => {
  const access = await accessGuard(ctx);
  if (!access.ok) return;
  await ctx.reply(`User ID: ${ctx.from.id}\nChat ID: ${ctx.chat.id}`);
});

bot.command("userinfo", async (ctx) => {
  const access = await accessGuard(ctx);
  if (!access.ok) return;
  const { user } = access;
  await ctx.reply(
    `👤 User Info

ID: ${user.userId}
Name: ${user.firstName || ""} ${user.lastName || ""}
Username: @${user.username || "-"}
Language: ${user.language}
Role: ${user.role}
Banned: ${user.isBanned ? "Yes" : "No"}
Joined: ${formatDate(user.joinedAt)}`
  );
});

bot.command("groupinfo", async (ctx) => {
  const access = await accessGuard(ctx);
  if (!access.ok) return;
  if (!isGroup(ctx)) return ctx.reply(t(access.lang, "onlyGroup"));
  const group = await Group.findOne({ groupId: ctx.chat.id });
  await ctx.reply(
    `👥 Group Info

ID: ${ctx.chat.id}
Title: ${ctx.chat.title || "-"}
Status: ${group?.status || "-"}
Enabled: ${group?.isEnabled ? "Yes" : "No"}
Blacklisted: ${group?.isBlacklisted ? "Yes" : "No"}
Filters: ${group?.settings?.filtersEnabled ? "ON" : "OFF"}
Clean Services: ${group?.settings?.cleanServicesEnabled ? "ON" : "OFF"}\nWelcome: ${group?.settings?.welcomeEnabled ? "ON" : "OFF"}\nWelcome Photo: ${group?.settings?.welcomePhotoEnabled ? "ON" : "OFF"}\nWelcome Text: ${group?.settings?.welcomeTextEnabled ? "ON" : "OFF"}`
  );
});

// ======================= FAQ / SEARCH / AUTO REPLY =======================
bot.command("faq", async (ctx) => {
  const access = await accessGuard(ctx);
  if (!access.ok) return;
  if (!(await forceJoinGuard(ctx, access.lang, access.settings))) return;
  const rows = await FAQ.find({ status: "active" }).sort({ createdAt: -1 }).limit(10);
  if (!rows.length) return ctx.reply(t(access.lang, "faqNone"));
  const out = rows.map((r, i) => {
    const q = access.lang === "en" ? (r.question_en || r.question_my) : (r.question_my || r.question_en);
    const cat = r.category ? ` [${r.category}]` : "";
    const mode = r.matchMode ? ` {${r.matchMode}}` : "";
    return `${i + 1}. ${q}${cat}${mode}`;
  }).join("\n");
  await ctx.reply(`📚 FAQ\n\n${out}`);
});

bot.command("search", async (ctx) => {
  const access = await accessGuard(ctx);
  if (!access.ok) return;
  if (!(await forceJoinGuard(ctx, access.lang, access.settings))) return;

  const q = cleanCmd(ctx.message.text, "search");
  if (!q) return ctx.reply(access.lang === "en" ? "Usage: /search keyword" : "အသုံးပြုပုံ: /search keyword");

  const faq = await FAQ.find({
    status: "active",
    $or: [
      { question_my: { $regex: q, $options: "i" } },
      { question_en: { $regex: q, $options: "i" } },
      { answer_my: { $regex: q, $options: "i" } },
      { answer_en: { $regex: q, $options: "i" } },
      { keywords: { $in: [q.toLowerCase()] } },
    ],
  }).limit(5);

  const saved = await SavedContent.find({
    $or: [
      { keyword: { $regex: q, $options: "i" } },
      { text: { $regex: q, $options: "i" } },
      { caption_my: { $regex: q, $options: "i" } },
      { caption_en: { $regex: q, $options: "i" } },
    ],
  }).limit(5);

  const commands = await CustomCommand.find({ command: { $regex: q, $options: "i" } }).limit(5);

  if (!faq.length && !saved.length && !commands.length) {
    return ctx.reply(
      t(access.lang, "noResult") + (access.lang === "en" ? "\nTry another keyword or use /ticket" : "\nအခြား keyword နဲ့ရှာပါ သို့မဟုတ် /ticket ကိုသုံးပါ"),
      Markup.inlineKeyboard([[Markup.button.callback(access.lang === "en" ? "🎫 Open Ticket" : "🎫 Ticket ဖွင့်မည်", "menu:support")]])
    );
  }

  let out = `🔎 Results for: ${q}\n`;
  if (faq.length) out += `\n📚 FAQ\n${faq.map((x) => `• ${access.lang === "en" ? (x.question_en || x.question_my) : (x.question_my || x.question_en)}`).join("\n")}`;
  if (saved.length) out += `\n\n🗂 Saved\n${saved.map((x) => `• ${x.keyword} (${x.type})`).join("\n")}`;
  if (commands.length) out += `\n\n⌨️ Commands\n${commands.map((x) => `• /${x.command}`).join("\n")}`;
  await ctx.reply(out);
});

// Keyword auto reply
bot.on("text", async (ctx, next) => {
  if (ctx.message.text.startsWith("/")) return next();

  const access = await accessGuard(ctx);
  if (!access.ok) return;
  const { lang, settings } = access;
  if (!settings.autoReplyEnabled) return next();

  // ticket waiting
  if (ctx.session?.awaitingTicket && isPrivate(ctx)) {
    const body = toText(ctx.message.text);
    if (!body) return ctx.reply(t(lang, "invalid"));
    const id = ticketId();
    await Ticket.create({
      ticketId: id,
      userId: ctx.from.id,
      username: ctx.from.username || "",
      language: lang,
      subject: body.slice(0, 60),
      status: "open",
      messages: [{ senderId: ctx.from.id, senderRole: "user", text: body }],
    });
    await User.updateOne({ userId: ctx.from.id }, { $inc: { totalTickets: 1 } });
    ctx.session.awaitingTicket = false;
    await ctx.reply(t(lang, "ticketCreated", id));
    try {
      await bot.telegram.sendMessage(
        OWNER_ID,
        `🎫 New Ticket\n\nTicket: ${id}\nFrom: ${ctx.from.first_name || ""} (@${ctx.from.username || "-"})\nUser ID: ${ctx.from.id}\n\n${body}`
      );
    } catch {}
    return;
  }

  // FAQ quick reply
  const rows = await FAQ.find({ status: "active" }).limit(50);
  const text = toText(ctx.message.text).toLowerCase();

  for (const row of rows) {
    const keys = [
      row.question_my,
      row.question_en,
      ...(row.keywords || []),
    ].filter(Boolean).map((x) => String(x).toLowerCase());

    const hit = keys.some((k) => row.matchMode === "exact" ? (text === k || text.split(/\s+/).includes(k)) : text.includes(k));
    if (hit) {
      const ans = lang === "en" ? (row.answer_en || row.answer_my) : (row.answer_my || row.answer_en);
      if (ans) {
        await ctx.reply(ans, Markup.inlineKeyboard([[Markup.button.callback(lang === "en" ? "🎫 No answer? Open Ticket" : "🎫 မလုံလောက်လား? Ticket ဖွင့်မည်", "menu:support")]]));
        return;
      }
    }
  }

  // custom commands by plain text keywords are not auto-triggered
  return next();
});

// ======================= TICKETS =======================
bot.command("ticket", async (ctx) => {
  const access = await accessGuard(ctx);
  if (!access.ok) return;
  if (!isPrivate(ctx)) return ctx.reply(t(access.lang, "needPrivate"));
  if (!access.settings.ticketEnabled) return ctx.reply(access.lang === "en" ? "Ticket system is disabled." : "Ticket system ပိတ်ထားပါတယ်။");
  ctx.session = ctx.session || {};
  ctx.session = ctx.session || {};
  ctx.session.awaitingTicket = true;
  await ctx.reply(t(access.lang, "ticketAsk"));
});

bot.command("mytickets", async (ctx) => {
  const access = await accessGuard(ctx);
  if (!access.ok) return;
  const rows = await Ticket.find({ userId: ctx.from.id }).sort({ updatedAt: -1 }).limit(10);
  if (!rows.length) return ctx.reply(access.lang === "en" ? "No tickets yet." : "Ticket မရှိသေးပါ။");
  const out = rows.map((x) => `• ${x.ticketId} — ${x.status} — ${formatDate(x.updatedAt)}`).join("\n");
  await ctx.reply(`🎫 My Tickets\n\n${out}`);
});

bot.command("closeticket", async (ctx) => {
  const access = await accessGuard(ctx);
  if (!access.ok) return;
  const id = splitArgs(ctx.message.text).args[0];
  if (!id) return ctx.reply("Usage: /closeticket TCK-XXX");
  const ticket = await Ticket.findOne({ ticketId: id, userId: ctx.from.id });
  if (!ticket) return ctx.reply(access.lang === "en" ? "Ticket not found." : "Ticket မတွေ့ပါ။");
  ticket.status = "closed";
  ticket.closedAt = now();
  await ticket.save();
  await ctx.reply(t(access.lang, "ticketClosed"));
});

bot.command("replyticket", async (ctx) => {
  const access = await accessGuard(ctx);
  if (!access.ok) return;
  const raw = cleanCmd(ctx.message.text, "replyticket");
  const [id, ...rest] = raw.split(/\s+/);
  const body = rest.join(" ").trim();
  if (!id || !body) return ctx.reply("Usage: /replyticket TCK-XXX your message");
  const ticket = await Ticket.findOne({ ticketId: id, userId: ctx.from.id });
  if (!ticket) return ctx.reply(access.lang === "en" ? "Ticket not found." : "Ticket မတွေ့ပါ။");
  ticket.messages.push({ senderId: ctx.from.id, senderRole: "user", text: body });
  if (ticket.status === "closed") ticket.status = "reopened";
  await ticket.save();
  await ctx.reply(access.lang === "en" ? "Reply added." : "Reply ထည့်ပြီးပါပြီ။");
  try {
    await bot.telegram.sendMessage(OWNER_ID, `💬 Ticket Reply\n\nTicket: ${ticket.ticketId}\nFrom: ${ctx.from.id}\n\n${body}`);
  } catch {}
});

// ======================= SAVED CONTENT =======================
bot.command("get", async (ctx) => {
  const access = await accessGuard(ctx);
  if (!access.ok) return;
  const key = cleanCmd(ctx.message.text, "get");
  if (!key) return ctx.reply("Usage: /get keyword");
  const item = await SavedContent.findOne({ keyword: key.toLowerCase() });
  if (!item) return ctx.reply(access.lang === "en" ? "Saved content not found." : "သိမ်းထားသော content မတွေ့ပါ။");

  const caption = access.lang === "en" ? (item.caption_en || item.caption_my || "") : (item.caption_my || item.caption_en || "");
  if (item.type === "text") return ctx.reply(item.text || "");
  if (item.type === "photo" && item.fileId) return ctx.replyWithPhoto(item.fileId, { caption });
  if (item.type === "video" && item.fileId) return ctx.replyWithVideo(item.fileId, { caption });
  if (item.type === "document" && item.fileId) return ctx.replyWithDocument(item.fileId, { caption });
  if (item.type === "link") return ctx.reply(item.text || "");
  return ctx.reply(access.lang === "en" ? "Saved content is incomplete." : "Saved content မပြည့်စုံသေးပါ။");
});

bot.command("notes", async (ctx) => {
  const access = await accessGuard(ctx);
  if (!access.ok) return;
  const rows = await SavedContent.find().sort({ createdAt: -1 }).limit(20);
  if (!rows.length) return ctx.reply(access.lang === "en" ? "No saved content." : "Saved content မရှိသေးပါ။");
  await ctx.reply("🗂 Saved Keywords\n\n" + rows.map((x) => `• ${x.keyword} (${x.type})${x.category ? ` [${x.category}]` : ""}`).join("\n"));
});

bot.command("saved", async (ctx) => {
  const access = await accessGuard(ctx);
  if (!access.ok) return;
  await ctx.reply(access.lang === "en" ? "Use /get <keyword> or /notes" : "/get <keyword> သို့မဟုတ် /notes ကိုသုံးပါ");
});

// ======================= TOOLS =======================
function simpleTextTransform(cmd, text) {
  switch (cmd) {
    case "mono": return `<code>${escapeHtml(text)}</code>`;
    case "bold": return `<b>${escapeHtml(text)}</b>`;
    case "underline": return `<u>${escapeHtml(text)}</u>`;
    case "spoiler": return `<tg-spoiler>${escapeHtml(text)}</tg-spoiler>`;
    case "reverse": return text.split("").reverse().join("");
    case "upper": return text.toUpperCase();
    case "lower": return text.toLowerCase();
    default: return text;
  }
}

["mono", "bold", "underline", "spoiler", "reverse", "upper", "lower"].forEach((name) => {
  bot.command(name, async (ctx) => {
    const access = await accessGuard(ctx);
    if (!access.ok) return;
    const text = cleanCmd(ctx.message.text, name);
    if (!text) return ctx.reply(`Usage: /${name} text`);
    const out = simpleTextTransform(name, text);
    if (["mono", "bold", "underline", "spoiler"].includes(name)) {
      return ctx.replyWithHTML(out);
    }
    return ctx.reply(out);
  });
});

bot.command("calc", async (ctx) => {
  const access = await accessGuard(ctx);
  if (!access.ok) return;
  try {
    const expr = cleanCmd(ctx.message.text, "calc");
    if (!expr) return ctx.reply("Usage: /calc 1+2*3");
    const result = safeEvalMath(expr);
    await ctx.reply(`🧮 ${expr} = ${result}`);
  } catch {
    await ctx.reply(access.lang === "en" ? "Invalid expression." : "Expression မှားနေပါတယ်။");
  }
});

bot.command("password", async (ctx) => {
  const access = await accessGuard(ctx);
  if (!access.ok) return;
  await ctx.reply(randomPassword(12));
});

bot.command("flip", async (ctx) => {
  const access = await accessGuard(ctx);
  if (!access.ok) return;
  await ctx.reply(Math.random() < 0.5 ? "Heads" : "Tails");
});

bot.command("choose", async (ctx) => {
  const access = await accessGuard(ctx);
  if (!access.ok) return;
  const raw = cleanCmd(ctx.message.text, "choose");
  const list = raw.split("|").map((x) => x.trim()).filter(Boolean);
  if (list.length < 2) return ctx.reply("Usage: /choose a | b | c");
  await ctx.reply(`🎯 ${choose(list)}`);
});

bot.command("extractlink", async (ctx) => {
  const access = await accessGuard(ctx);
  if (!access.ok) return;
  const raw = cleanCmd(ctx.message.text, "extractlink");
  if (!raw) return ctx.reply("Usage: /extractlink text");
  const links = findUrls(raw);
  if (!links.length) return ctx.reply(access.lang === "en" ? "No links found." : "Link မတွေ့ပါ။");
  await ctx.reply(links.join("\n"));
});

bot.command("time", async (ctx) => {
  const access = await accessGuard(ctx);
  if (!access.ok) return;
  await ctx.reply(`🕒 ${formatDate(now())} (${TZ})`);
});

bot.command("translate", async (ctx) => {
  const access = await accessGuard(ctx);
  if (!access.ok) return;
  const raw = cleanCmd(ctx.message.text, "translate");
  if (!raw) return ctx.reply("Usage: /translate text");
  await ctx.reply(access.lang === "en" ? `Translate scaffold:\n${raw}` : `ဘာသာပြန် scaffold:\n${raw}`);
});

bot.command("qr", async (ctx) => {
  const access = await accessGuard(ctx);
  if (!access.ok) return;
  const raw = cleanCmd(ctx.message.text, "qr");
  if (!raw) return ctx.reply("Usage: /qr text");
  await ctx.reply(`QR scaffold:\n${raw}`);
});

bot.command("fileid", async (ctx) => {
  const access = await accessGuard(ctx);
  if (!access.ok) return;
  const reply = ctx.message.reply_to_message;
  if (!reply) return ctx.reply("Reply to a photo/video/document.");
  let type = null;
  let fileId = null;
  if (reply.photo?.length) {
    type = "photo";
    fileId = reply.photo[reply.photo.length - 1].file_id;
  } else if (reply.video?.file_id) {
    type = "video";
    fileId = reply.video.file_id;
  } else if (reply.document?.file_id) {
    type = "document";
    fileId = reply.document.file_id;
  }
  if (!fileId) return ctx.reply("No supported media found in replied message.");
  await ctx.reply(`Type: ${type}\nFile ID:\n${fileId}`);
});

// ======================= USER FEEDBACK / REFERRAL =======================
bot.command("feedback", async (ctx) => {
  const access = await accessGuard(ctx);
  if (!access.ok) return;
  if (!access.settings.feedbackEnabled) return ctx.reply(access.lang === "en" ? "Feedback is disabled." : "Feedback ပိတ်ထားပါတယ်။");
  const text = cleanCmd(ctx.message.text, "feedback");
  if (!text) return ctx.reply("Usage: /feedback your message");
  await Feedback.create({ userId: ctx.from.id, text, rating: 0 });
  await ctx.reply(access.lang === "en" ? "Feedback saved." : "Feedback သိမ်းပြီးပါပြီ။");
});

bot.command("rate", async (ctx) => {
  const access = await accessGuard(ctx);
  if (!access.ok) return;
  const n = Number(splitArgs(ctx.message.text).args[0] || 0);
  if (!n || n < 1 || n > 5) return ctx.reply("Usage: /rate 1-5");
  await Feedback.create({ userId: ctx.from.id, rating: n, text: "" });
  await ctx.reply(access.lang === "en" ? "Thanks for rating." : "Rating ပေးလို့ကျေးဇူးတင်ပါတယ်။");
});

bot.command("referral", async (ctx) => {
  const access = await accessGuard(ctx);
  if (!access.ok) return;
  const ref = await Referral.findOne({ userId: ctx.from.id });
  const username = BOT_USERNAME ? `https://t.me/${BOT_USERNAME}?start=ref_${ctx.from.id}` : `Use start payload ref_${ctx.from.id}`;
  await ctx.reply(`🔗 Referral

Code: ${ref?.code || referralCode(ctx.from.id)}
Invited: ${ref?.invitedCount || 0}
Link: ${username}`);
});

bot.command("invite", async (ctx) => {
  const access = await accessGuard(ctx);
  if (!access.ok) return;
  if (!BOT_USERNAME) return ctx.reply("Set BOT_USERNAME in .env");
  await ctx.reply(`https://t.me/${BOT_USERNAME}?start=ref_${ctx.from.id}`);
});

// ======================= GROUP HELP / SETTINGS =======================
bot.command("ghelp", async (ctx) => {
  const access = await accessGuard(ctx);
  if (!access.ok) return;
  if (!isGroup(ctx)) return ctx.reply(t(access.lang, "onlyGroup"));
  await ctx.reply(`Group Commands

/filter add WORD
/filter del WORD
/filters
/filter on
/filter off

/cleanservices on|off
/cleanjoin on|off
/cleanleave on|off
/cleanpin on|off
/cleanvoice on|off
/cleantitle on|off
/cleanphoto on|off
/cleanstatus

/welcome on|off
/welcomephoto on|off
/welcometext on|off
/setwelcome your text
/welcomestatus

/groupsettings
/approval
/requestapprove`);
});

bot.command("groupsettings", async (ctx) => {
  const access = await accessGuard(ctx);
  if (!access.ok) return;
  if (!isGroup(ctx)) return ctx.reply(t(access.lang, "onlyGroup"));
  const g = await Group.findOne({ groupId: ctx.chat.id });
  if (!g) return ctx.reply("Group not found.");
  await ctx.reply(
    `⚙️ Group Settings

Status: ${g.status}
Enabled: ${g.isEnabled}
Blacklisted: ${g.isBlacklisted}
Filters: ${g.settings.filtersEnabled ? "ON" : "OFF"}
CleanServices: ${g.settings.cleanServicesEnabled ? "ON" : "OFF"}
CleanJoin: ${g.settings.cleanJoin ? "ON" : "OFF"}
CleanLeave: ${g.settings.cleanLeave ? "ON" : "OFF"}
CleanPin: ${g.settings.cleanPin ? "ON" : "OFF"}
CleanVoice: ${g.settings.cleanVoice ? "ON" : "OFF"}
CleanTitle: ${g.settings.cleanTitle ? "ON" : "OFF"}
CleanPhoto: ${g.settings.cleanPhoto ? "ON" : "OFF"}`
  );
});

bot.command("approval", async (ctx) => {
  const access = await accessGuard(ctx);
  if (!access.ok) return;
  if (!isGroup(ctx)) return ctx.reply(t(access.lang, "onlyGroup"));
  const settings = await getSettings();
  const g = await Group.findOne({ groupId: ctx.chat.id });
  await ctx.reply(`Approval Mode: ${settings.approvalRequired ? "ON" : "OFF"}\nGroup Status: ${g?.status || "-"}`);
});

bot.command("requestapprove", async (ctx) => {
  const access = await accessGuard(ctx);
  if (!access.ok) return;
  if (!isGroup(ctx)) return ctx.reply(t(access.lang, "onlyGroup"));
  const g = await Group.findOne({ groupId: ctx.chat.id });
  try {
    await bot.telegram.sendMessage(
      OWNER_ID,
      `📥 Group Approval Request

Group: ${ctx.chat.title}
Group ID: ${ctx.chat.id}
Status: ${g?.status || "-"}
By: ${ctx.from.first_name || ""} (@${ctx.from.username || "-"})`
    );
  } catch {}
  await ctx.reply(access.lang === "en" ? "Approval request sent to owner." : "Approval request ကို owner ဆီ ပို့ပြီးပါပြီ။");
});

// ======================= FILTERS =======================
async function requireGroupAdminOrHigher(ctx, lang) {
  if (!isGroup(ctx)) {
    await ctx.reply(t(lang, "onlyGroup"));
    return false;
  }
  if (await isOwner(ctx.from.id)) return true;
  if (await isAdmin(ctx.from.id)) return true;
  try {
    const mem = await ctx.getChatMember(ctx.from.id);
    if (["creator", "administrator"].includes(mem.status)) return true;
  } catch {}
  await ctx.reply(t(lang, "noPerm"));
  return false;
}

bot.command("filter", async (ctx) => {
  const access = await accessGuard(ctx);
  if (!access.ok) return;
  if (!(await requireGroupAdminOrHigher(ctx, access.lang))) return;

  const args = splitArgs(ctx.message.text).args;
  const sub = (args[0] || "").toLowerCase();

  if (sub === "add") {
    const word = args.slice(1).join(" ").trim().toLowerCase();
    if (!word) return ctx.reply("Usage: /filter add word");
    await Filter.findOneAndUpdate(
      { scope: "group", groupId: ctx.chat.id, pattern: word },
      { $set: { matchType: "partial", actionType: "delete_warn", enabled: true, createdBy: ctx.from.id } },
      { upsert: true, new: true }
    );
    return ctx.reply("Group filter added.");
  }

  if (sub === "del") {
    const word = args.slice(1).join(" ").trim().toLowerCase();
    if (!word) return ctx.reply("Usage: /filter del word");
    await Filter.deleteOne({ scope: "group", groupId: ctx.chat.id, pattern: word });
    return ctx.reply("Group filter removed.");
  }

  if (sub === "on" || sub === "off") {
    await Group.updateOne({ groupId: ctx.chat.id }, { $set: { "settings.filtersEnabled": sub === "on" } });
    return ctx.reply(`Group filters ${sub.toUpperCase()}`);
  }

  return ctx.reply("Usage:\n/filter add word\n/filter del word\n/filter on\n/filter off");
});

bot.command("filters", async (ctx) => {
  const access = await accessGuard(ctx);
  if (!access.ok) return;
  if (!isGroup(ctx)) return ctx.reply(t(access.lang, "onlyGroup"));
  const rows = await Filter.find({ scope: "group", groupId: ctx.chat.id }).sort({ createdAt: -1 });
  if (!rows.length) return ctx.reply("No group filters.");
  await ctx.reply("Group Filters\n\n" + rows.map((x) => `• ${x.pattern} (${x.matchType}/${x.actionType})`).join("\n"));
});

bot.command("gfilter", async (ctx) => {
  const access = await accessGuard(ctx);
  if (!access.ok) return;
  if (!(await isOwner(ctx.from.id))) return ctx.reply(t(access.lang, "noPerm"));

  const args = splitArgs(ctx.message.text).args;
  const sub = (args[0] || "").toLowerCase();

  if (sub === "add") {
    const word = args.slice(1).join(" ").trim().toLowerCase();
    if (!word) return ctx.reply("Usage: /gfilter add word");
    await Filter.findOneAndUpdate(
      { scope: "global", pattern: word },
      { $set: { matchType: "partial", actionType: "delete_warn", enabled: true, createdBy: ctx.from.id } },
      { upsert: true, new: true }
    );
    return ctx.reply("Global filter added.");
  }

  if (sub === "del") {
    const word = args.slice(1).join(" ").trim().toLowerCase();
    if (!word) return ctx.reply("Usage: /gfilter del word");
    await Filter.deleteOne({ scope: "global", pattern: word });
    return ctx.reply("Global filter removed.");
  }

  if (sub === "on" || sub === "off") {
    await Setting.updateOne({}, { $set: { globalFilterEnabled: sub === "on" } });
    return ctx.reply(`Global filter ${sub.toUpperCase()}`);
  }

  return ctx.reply("Usage:\n/gfilter add word\n/gfilter del word\n/gfilter on\n/gfilter off");
});

bot.command("gfilters", async (ctx) => {
  const access = await accessGuard(ctx);
  if (!access.ok) return;
  if (!(await isOwner(ctx.from.id))) return ctx.reply(t(access.lang, "noPerm"));
  const rows = await Filter.find({ scope: "global" }).sort({ createdAt: -1 });
  if (!rows.length) return ctx.reply("No global filters.");
  await ctx.reply("Global Filters\n\n" + rows.map((x) => `• ${x.pattern} (${x.matchType}/${x.actionType})`).join("\n"));
});

// ======================= CLEAN SERVICES =======================
async function setCleanFlag(ctx, access, field, state) {
  if (!(await requireGroupAdminOrHigher(ctx, access.lang))) return;
  const setObj = { "settings.cleanServicesEnabled": true };
  setObj[`settings.${field}`] = state;
  await Group.updateOne({ groupId: ctx.chat.id }, { $set: setObj });
  await ctx.reply(`${field} => ${state ? "ON" : "OFF"}`);
}

bot.command("cleanservices", async (ctx) => {
  const access = await accessGuard(ctx);
  if (!access.ok) return;
  if (!(await requireGroupAdminOrHigher(ctx, access.lang))) return;
  const state = onOff(splitArgs(ctx.message.text).args[0]);
  await Group.updateOne({ groupId: ctx.chat.id }, { $set: { "settings.cleanServicesEnabled": state } });
  await ctx.reply(`Clean Services ${state ? "ON" : "OFF"}`);
});

bot.command("cleanjoin", async (ctx) => {
  const access = await accessGuard(ctx); if (!access.ok) return;
  await setCleanFlag(ctx, access, "cleanJoin", onOff(splitArgs(ctx.message.text).args[0]));
});
bot.command("cleanleave", async (ctx) => {
  const access = await accessGuard(ctx); if (!access.ok) return;
  await setCleanFlag(ctx, access, "cleanLeave", onOff(splitArgs(ctx.message.text).args[0]));
});
bot.command("cleanpin", async (ctx) => {
  const access = await accessGuard(ctx); if (!access.ok) return;
  await setCleanFlag(ctx, access, "cleanPin", onOff(splitArgs(ctx.message.text).args[0]));
});
bot.command("cleanvoice", async (ctx) => {
  const access = await accessGuard(ctx); if (!access.ok) return;
  await setCleanFlag(ctx, access, "cleanVoice", onOff(splitArgs(ctx.message.text).args[0]));
});
bot.command("cleantitle", async (ctx) => {
  const access = await accessGuard(ctx); if (!access.ok) return;
  await setCleanFlag(ctx, access, "cleanTitle", onOff(splitArgs(ctx.message.text).args[0]));
});
bot.command("cleanphoto", async (ctx) => {
  const access = await accessGuard(ctx); if (!access.ok) return;
  await setCleanFlag(ctx, access, "cleanPhoto", onOff(splitArgs(ctx.message.text).args[0]));
});

bot.command("cleanstatus", async (ctx) => {
  const access = await accessGuard(ctx);
  if (!access.ok) return;
  if (!isGroup(ctx)) return ctx.reply(t(access.lang, "onlyGroup"));
  const g = await Group.findOne({ groupId: ctx.chat.id });
  if (!g) return ctx.reply("Group not found.");
  await ctx.reply(
    `🧹 Clean Status

Enabled: ${g.settings.cleanServicesEnabled ? "ON" : "OFF"}
Join: ${g.settings.cleanJoin ? "ON" : "OFF"}
Leave: ${g.settings.cleanLeave ? "ON" : "OFF"}
Pin: ${g.settings.cleanPin ? "ON" : "OFF"}
Voice: ${g.settings.cleanVoice ? "ON" : "OFF"}
Title: ${g.settings.cleanTitle ? "ON" : "OFF"}
Photo: ${g.settings.cleanPhoto ? "ON" : "OFF"}`
  );
});


bot.command("setwelcome", async (ctx) => {
  const access = await accessGuard(ctx);
  if (!access.ok) return;
  if (!(await requireGroupAdminOrHigher(ctx, access.lang))) return;
  const text = cleanCmd(ctx.message.text, "setwelcome");
  if (!text) {
    return ctx.reply("Usage: /setwelcome your custom welcome text");
  }
  await Group.updateOne({ groupId: ctx.chat.id }, { $set: { "settings.welcomeTextMy": text, "settings.welcomeEnabled": true, "settings.welcomeTextEnabled": true } });
  await ctx.reply("Custom welcome text saved.");
});


bot.command("testwelcome", async (ctx) => {
  try {
    if (!["group", "supergroup"].includes(ctx.chat?.type)) {
      return ctx.reply("Group only");
    }

    const group = await ensureGroup(ctx.chat);
    const fullName = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(" ").trim() || "User";
    const mention = ctx.from.username
      ? `@${ctx.from.username}`
      : `<a href="tg://user?id=${ctx.from.id}">${escapeHtml(fullName)}</a>`;
    const groupName = ctx.chat.title || "Group";

    const text = `မင်္ဂလာပါ ${mention} ရေ

${escapeHtml(groupName)} မှ ကြိုဆိုပါတယ်

အချင်းချင်း စကားတွေပြောရင်း

ပျော်ရွှင်စရာနေ့ရက်တွေ ပိုင်ဆိုင်နိူင်ပါစေ`;

    if (group?.settings?.welcomePhotoEnabled && typeof buildWelcomeImage === "function") {
      try {
        const avatarBuffer = await getUserAvatarBuffer(ctx.from.id);
        const buffer = await buildWelcomeImage(fullName, groupName, avatarBuffer);
        await ctx.replyWithPhoto(
          { source: buffer },
          { caption: text, parse_mode: "HTML" }
        );
        return;
      } catch (e) {
        console.log("[TESTWELCOME] photo failed:", e?.message || e);
      }
    }

    await ctx.replyWithHTML(text);
  } catch (e) {
    console.log("[TESTWELCOME] error:", e?.message || e);
    await ctx.reply("testwelcome failed");
  }
});

bot.command("welcomestatus", async (ctx) => {
  const access = await accessGuard(ctx);
  if (!access.ok) return;
  if (!isGroup(ctx)) return ctx.reply(t(access.lang, "onlyGroup"));
  const g = await Group.findOne({ groupId: ctx.chat.id });
  if (!g) return ctx.reply("Group not found.");
  await ctx.reply(
    `👋 Welcome Status

Enabled: ${g.settings.welcomeEnabled ? "ON" : "OFF"}
Photo: ${g.settings.welcomePhotoEnabled ? "ON" : "OFF"}
Text: ${g.settings.welcomeTextEnabled ? "ON" : "OFF"}
Custom Text: ${g.settings.welcomeTextMy ? "YES" : "DEFAULT"}`
  );
});

bot.command("welcome", async (ctx) => {
  const access = await accessGuard(ctx);
  if (!access.ok) return;
  if (!(await requireGroupAdminOrHigher(ctx, access.lang))) return;
  const state = onOff(splitArgs(ctx.message.text).args[0]);
  await Group.updateOne({ groupId: ctx.chat.id }, { $set: { "settings.welcomeEnabled": state } });
  await ctx.reply(`Welcome ${state ? "ON" : "OFF"}`);
});

bot.command("welcomephoto", async (ctx) => {
  const access = await accessGuard(ctx);
  if (!access.ok) return;
  if (!(await requireGroupAdminOrHigher(ctx, access.lang))) return;
  const state = onOff(splitArgs(ctx.message.text).args[0]);
  await Group.updateOne({ groupId: ctx.chat.id }, { $set: { "settings.welcomePhotoEnabled": state, "settings.welcomeEnabled": true } });
  await ctx.reply(`Welcome Photo ${state ? "ON" : "OFF"}`);
});

bot.command("welcometext", async (ctx) => {
  const access = await accessGuard(ctx);
  if (!access.ok) return;
  if (!(await requireGroupAdminOrHigher(ctx, access.lang))) return;
  const state = onOff(splitArgs(ctx.message.text).args[0]);
  await Group.updateOne({ groupId: ctx.chat.id }, { $set: { "settings.welcomeTextEnabled": state, "settings.welcomeEnabled": true } });
  await ctx.reply(`Welcome Text ${state ? "ON" : "OFF"}`);
});


// ======================= WARNS / USER MGMT =======================
bot.command("warn", async (ctx) => {
  const access = await accessGuard(ctx);
  if (!access.ok) return;
  if (!(await requireGroupAdminOrHigher(ctx, access.lang))) return;

  const replyUser = ctx.message.reply_to_message?.from;
  if (!replyUser) return ctx.reply("Reply to a user's message.");
  const doc = await Warn.findOneAndUpdate(
    { userId: replyUser.id, groupId: ctx.chat.id },
    { $inc: { count: 1 }, $set: { lastReason: "manual warn", updatedBy: ctx.from.id } },
    { upsert: true, new: true }
  );
  await User.updateOne({ userId: replyUser.id }, { $set: { warnCount: doc.count } });
  await ctx.reply(`⚠️ Warned ${replyUser.first_name}. Total warns: ${doc.count}`);
});

bot.command("warnings", async (ctx) => {
  const access = await accessGuard(ctx);
  if (!access.ok) return;
  if (!isGroup(ctx)) return ctx.reply(t(access.lang, "onlyGroup"));
  const replyUser = ctx.message.reply_to_message?.from;
  if (!replyUser) return ctx.reply("Reply to a user's message.");
  const doc = await Warn.findOne({ userId: replyUser.id, groupId: ctx.chat.id });
  await ctx.reply(`Warnings: ${doc?.count || 0}`);
});

bot.command("clearwarns", async (ctx) => {
  const access = await accessGuard(ctx);
  if (!access.ok) return;
  if (!(await requireGroupAdminOrHigher(ctx, access.lang))) return;

  const replyUser = ctx.message.reply_to_message?.from;
  if (!replyUser) return ctx.reply("Reply to a user's message.");
  await Warn.deleteOne({ userId: replyUser.id, groupId: ctx.chat.id });
  await User.updateOne({ userId: replyUser.id }, { $set: { warnCount: 0 } });
  await ctx.reply("Warns cleared.");
});

// ======================= ADMIN COMMANDS =======================
bot.command("admin", async (ctx) => {
  const access = await accessGuard(ctx);
  if (!access.ok) return;
  if (!(await isAdmin(ctx.from.id))) return ctx.reply(t(access.lang, "noPerm"));
  await ctx.reply(
    `🛠 Admin Panel

/addfaq question | answer
/editfaq ID | question | answer
/delfaq ID
/faqlist

/save keyword | text
/editsave keyword | new text
/delsave keyword
/savedlist

/tickets
/opentickets
/closedtickets
/ticketreply TCK-XXX message
/closeticketadmin TCK-XXX

/ban USER_ID
/unban USER_ID
/user USER_ID
/finduser KEYWORD

/stats
/logs
/errorlogs
/filterlogs
/broadcast reply_to_message`
  );
});

bot.command("admins", async (ctx) => {
  const access = await accessGuard(ctx);
  if (!access.ok) return;
  if (!(await isAdmin(ctx.from.id))) return ctx.reply(t(access.lang, "noPerm"));
  const rows = await Admin.find({ active: true }).sort({ createdAt: 1 });
  const out = rows.length ? rows.map((x) => `• ${x.userId} ${x.name || ""} @${x.username || "-"}`).join("\n") : "No admins.";
  await ctx.reply(`Admins\n\n${out}`);
});

// FAQ manage
bot.command("addfaq", async (ctx) => {
  const access = await accessGuard(ctx);
  if (!access.ok) return;
  if (!(await isAdmin(ctx.from.id))) return ctx.reply(t(access.lang, "noPerm"));
  const raw = cleanCmd(ctx.message.text, "addfaq");
  const parts = raw.split("|").map((x) => x.trim());
  if (parts.length < 2) return ctx.reply("Usage: /addfaq question | answer | category(optional) | exact|partial(optional)");
  const [question, answer, category, mode] = parts;
  const matchMode = ["exact", "partial"].includes(String(mode || "").toLowerCase()) ? String(mode).toLowerCase() : "partial";
  await FAQ.create({
    question_my: question,
    question_en: question,
    answer_my: answer,
    answer_en: answer,
    category: category || "general",
    matchMode,
    keywords: question.toLowerCase().split(/\s+/).slice(0, 8),
    createdBy: ctx.from.id,
    updatedBy: ctx.from.id,
  });
  await ctx.reply(`FAQ added. Category: ${category || "general"} | Mode: ${matchMode}`);
});

bot.command("editfaq", async (ctx) => {
  const access = await accessGuard(ctx); if (!access.ok) return;
  if (!(await isAdmin(ctx.from.id))) return ctx.reply(t(access.lang, "noPerm"));
  const raw = cleanCmd(ctx.message.text, "editfaq");
  const parts = raw.split("|").map((x) => x.trim());
  if (parts.length < 3) return ctx.reply("Usage: /editfaq FAQ_ID | question | answer | category(optional) | exact|partial(optional)");
  const [id, q, a, category, mode] = parts;
  const faq = await FAQ.findById(id).catch(() => null);
  if (!faq) return ctx.reply("FAQ not found.");
  faq.question_my = q;
  faq.question_en = q;
  faq.answer_my = a;
  faq.answer_en = a;
  if (category) faq.category = category;
  if (["exact", "partial"].includes(String(mode || "").toLowerCase())) faq.matchMode = String(mode).toLowerCase();
  faq.updatedBy = ctx.from.id;
  await faq.save();
  await ctx.reply("FAQ updated.");
});

bot.command("delfaq", async (ctx) => {
  const access = await accessGuard(ctx); if (!access.ok) return;
  if (!(await isAdmin(ctx.from.id))) return ctx.reply(t(access.lang, "noPerm"));
  const id = splitArgs(ctx.message.text).args[0];
  if (!id) return ctx.reply("Usage: /delfaq FAQ_ID");
  await FAQ.findByIdAndDelete(id).catch(() => null);
  await ctx.reply("FAQ deleted.");
});

bot.command("faqlist", async (ctx) => {
  const access = await accessGuard(ctx); if (!access.ok) return;
  if (!(await isAdmin(ctx.from.id))) return ctx.reply(t(access.lang, "noPerm"));
  const rows = await FAQ.find().sort({ createdAt: -1 }).limit(20);
  if (!rows.length) return ctx.reply("No FAQ.");
  await ctx.reply("FAQ List\n\n" + rows.map((x) => `• ${x._id} | ${x.question_my || x.question_en}`).join("\n"));
});

// Saved manage
bot.command("save", async (ctx) => {
  const access = await accessGuard(ctx); if (!access.ok) return;
  if (!(await isAdmin(ctx.from.id))) return ctx.reply(t(access.lang, "noPerm"));

  const raw = cleanCmd(ctx.message.text, "save");
  const parts = raw.split("|").map((x) => x.trim());
  const reply = ctx.message.reply_to_message;

  if (reply && parts.length >= 1) {
    const keyword = parts[0].toLowerCase();
    const caption = parts.slice(1).join(" | ");
    let type = null;
    let fileId = null;
    if (reply.photo?.length) {
      type = "photo";
      fileId = reply.photo[reply.photo.length - 1].file_id;
    } else if (reply.video?.file_id) {
      type = "video";
      fileId = reply.video.file_id;
    } else if (reply.document?.file_id) {
      type = "document";
      fileId = reply.document.file_id;
    }

    if (type && fileId) {
      await SavedContent.findOneAndUpdate(
        { keyword },
        {
          $set: {
            keyword,
            type,
            fileId,
            text: "",
            caption_my: caption || reply.caption || "",
            caption_en: caption || reply.caption || "",
            updatedBy: ctx.from.id,
          },
          $setOnInsert: { createdBy: ctx.from.id },
        },
        { upsert: true, new: true }
      );
      return ctx.reply(`Saved ${type} as keyword: ${keyword}`);
    }
  }

  if (parts.length < 2) return ctx.reply("Usage: /save keyword | text  OR reply media with /save keyword | optional caption");

  const keyword = parts[0].toLowerCase();
  const text = parts.slice(1).join(" | ");
  await SavedContent.findOneAndUpdate(
    { keyword },
    {
      $set: {
        keyword,
        type: "text",
        text,
        caption_my: "",
        caption_en: "",
        updatedBy: ctx.from.id,
      },
      $setOnInsert: { createdBy: ctx.from.id },
    },
    { upsert: true, new: true }
  );
  await ctx.reply("Saved content stored.");
});

bot.command("editsave", async (ctx) => {
  const access = await accessGuard(ctx); if (!access.ok) return;
  if (!(await isAdmin(ctx.from.id))) return ctx.reply(t(access.lang, "noPerm"));
  const raw = cleanCmd(ctx.message.text, "editsave");
  const parts = raw.split("|").map((x) => x.trim());
  if (parts.length < 2) return ctx.reply("Usage: /editsave keyword | new text");
  const keyword = parts[0].toLowerCase();
  const text = parts.slice(1).join(" | ");
  const item = await SavedContent.findOne({ keyword });
  if (!item) return ctx.reply("Keyword not found.");
  item.text = text;
  item.updatedBy = ctx.from.id;
  await item.save();
  await ctx.reply("Saved content updated.");
});

bot.command("delsave", async (ctx) => {
  const access = await accessGuard(ctx); if (!access.ok) return;
  if (!(await isAdmin(ctx.from.id))) return ctx.reply(t(access.lang, "noPerm"));
  const keyword = cleanCmd(ctx.message.text, "delsave").toLowerCase();
  if (!keyword) return ctx.reply("Usage: /delsave keyword");
  await SavedContent.deleteOne({ keyword });
  await ctx.reply("Saved content deleted.");
});

bot.command("savedlist", async (ctx) => {
  const access = await accessGuard(ctx); if (!access.ok) return;
  if (!(await isAdmin(ctx.from.id))) return ctx.reply(t(access.lang, "noPerm"));
  const rows = await SavedContent.find().sort({ createdAt: -1 }).limit(30);
  if (!rows.length) return ctx.reply("No saved content.");
  await ctx.reply("Saved List\n\n" + rows.map((x) => `• ${x.keyword} (${x.type})${x.fileId ? " [media]" : ""}`).join("\n"));
});

// Ticket manage
bot.command("tickets", async (ctx) => {
  const access = await accessGuard(ctx); if (!access.ok) return;
  if (!(await isAdmin(ctx.from.id))) return ctx.reply(t(access.lang, "noPerm"));
  const rows = await Ticket.find().sort({ updatedAt: -1 }).limit(20);
  if (!rows.length) return ctx.reply("No tickets.");
  await ctx.reply("Tickets\n\n" + rows.map((x) => `• ${x.ticketId} | ${x.status} | ${x.userId}`).join("\n"));
});

bot.command("opentickets", async (ctx) => {
  const access = await accessGuard(ctx); if (!access.ok) return;
  if (!(await isAdmin(ctx.from.id))) return ctx.reply(t(access.lang, "noPerm"));
  const rows = await Ticket.find({ status: { $in: ["open", "pending", "reopened"] } }).sort({ updatedAt: -1 }).limit(20);
  if (!rows.length) return ctx.reply("No open tickets.");
  await ctx.reply("Open Tickets\n\n" + rows.map((x) => `• ${x.ticketId} | ${x.status} | ${x.userId}`).join("\n"));
});

bot.command("closedtickets", async (ctx) => {
  const access = await accessGuard(ctx); if (!access.ok) return;
  if (!(await isAdmin(ctx.from.id))) return ctx.reply(t(access.lang, "noPerm"));
  const rows = await Ticket.find({ status: "closed" }).sort({ updatedAt: -1 }).limit(20);
  if (!rows.length) return ctx.reply("No closed tickets.");
  await ctx.reply("Closed Tickets\n\n" + rows.map((x) => `• ${x.ticketId} | ${x.userId}`).join("\n"));
});

bot.command("ticketreply", async (ctx) => {
  const access = await accessGuard(ctx); if (!access.ok) return;
  if (!(await isAdmin(ctx.from.id))) return ctx.reply(t(access.lang, "noPerm"));
  const raw = cleanCmd(ctx.message.text, "ticketreply");
  const [id, ...rest] = raw.split(/\s+/);
  const body = rest.join(" ").trim();
  if (!id || !body) return ctx.reply("Usage: /ticketreply TCK-XXX message");
  const ticket = await Ticket.findOne({ ticketId: id });
  if (!ticket) return ctx.reply("Ticket not found.");
  ticket.messages.push({ senderId: ctx.from.id, senderRole: "admin", text: body });
  ticket.status = "pending";
  ticket.assignedAdmin = ctx.from.id;
  await ticket.save();
  await ctx.reply("Ticket reply sent.");
  try {
    await bot.telegram.sendMessage(ticket.userId, `💬 Support Reply\n\nTicket: ${ticket.ticketId}\n\n${body}`);
  } catch {}
});

bot.command("closeticketadmin", async (ctx) => {
  const access = await accessGuard(ctx); if (!access.ok) return;
  if (!(await isAdmin(ctx.from.id))) return ctx.reply(t(access.lang, "noPerm"));
  const id = splitArgs(ctx.message.text).args[0];
  if (!id) return ctx.reply("Usage: /closeticketadmin TCK-XXX");
  const ticket = await Ticket.findOne({ ticketId: id });
  if (!ticket) return ctx.reply("Ticket not found.");
  ticket.status = "closed";
  ticket.closedAt = now();
  await ticket.save();
  await ctx.reply("Ticket closed.");
});

bot.command("reopenticket", async (ctx) => {
  const access = await accessGuard(ctx); if (!access.ok) return;
  if (!(await isAdmin(ctx.from.id))) return ctx.reply(t(access.lang, "noPerm"));
  const id = splitArgs(ctx.message.text).args[0];
  if (!id) return ctx.reply("Usage: /reopenticket TCK-XXX");
  const ticket = await Ticket.findOne({ ticketId: id });
  if (!ticket) return ctx.reply("Ticket not found.");
  ticket.status = "reopened";
  ticket.closedAt = null;
  await ticket.save();
  await ctx.reply("Ticket reopened.");
});

// User manage
bot.command("ban", async (ctx) => {
  const access = await accessGuard(ctx); if (!access.ok) return;
  if (!(await isAdmin(ctx.from.id))) return ctx.reply(t(access.lang, "noPerm"));
  const id = Number(splitArgs(ctx.message.text).args[0] || 0);
  if (!id) return ctx.reply("Usage: /ban USER_ID");
  await User.updateOne({ userId: id }, { $set: { isBanned: true } });
  await ctx.reply("User banned.");
});

bot.command("unban", async (ctx) => {
  const access = await accessGuard(ctx); if (!access.ok) return;
  if (!(await isAdmin(ctx.from.id))) return ctx.reply(t(access.lang, "noPerm"));
  const id = Number(splitArgs(ctx.message.text).args[0] || 0);
  if (!id) return ctx.reply("Usage: /unban USER_ID");
  await User.updateOne({ userId: id }, { $set: { isBanned: false } });
  await ctx.reply("User unbanned.");
});

bot.command("user", async (ctx) => {
  const access = await accessGuard(ctx); if (!access.ok) return;
  if (!(await isAdmin(ctx.from.id))) return ctx.reply(t(access.lang, "noPerm"));
  const id = Number(splitArgs(ctx.message.text).args[0] || 0);
  if (!id) return ctx.reply("Usage: /user USER_ID");
  const u = await User.findOne({ userId: id });
  if (!u) return ctx.reply("User not found.");
  await ctx.reply(
    `User
ID: ${u.userId}
Name: ${u.firstName || ""} ${u.lastName || ""}
Username: @${u.username || "-"}
Lang: ${u.language}
Role: ${u.role}
Banned: ${u.isBanned}
Warns: ${u.warnCount}
Tickets: ${u.totalTickets}`
  );
});

bot.command("finduser", async (ctx) => {
  const access = await accessGuard(ctx); if (!access.ok) return;
  if (!(await isAdmin(ctx.from.id))) return ctx.reply(t(access.lang, "noPerm"));
  const q = cleanCmd(ctx.message.text, "finduser");
  if (!q) return ctx.reply("Usage: /finduser keyword");
  const rows = await User.find({
    $or: [
      { firstName: { $regex: q, $options: "i" } },
      { lastName: { $regex: q, $options: "i" } },
      { username: { $regex: q, $options: "i" } },
      { userId: Number.isFinite(Number(q)) ? Number(q) : -1 },
    ],
  }).limit(10);
  if (!rows.length) return ctx.reply("No user found.");
  await ctx.reply(rows.map((u) => `• ${u.userId} | ${u.firstName || ""} @${u.username || "-"}`).join("\n"));
});

// Group manage
bot.command("groups", async (ctx) => {
  const access = await accessGuard(ctx); if (!access.ok) return;
  if (!(await isAdmin(ctx.from.id))) return ctx.reply(t(access.lang, "noPerm"));
  const rows = await Group.find().sort({ updatedAt: -1 }).limit(30);
  if (!rows.length) return ctx.reply("No groups.");
  await ctx.reply(rows.map((g) => `• ${g.groupId} | ${g.title} | ${g.status}`).join("\n"));
});

bot.command("group", async (ctx) => {
  const access = await accessGuard(ctx); if (!access.ok) return;
  if (!(await isAdmin(ctx.from.id))) return ctx.reply(t(access.lang, "noPerm"));
  const id = Number(splitArgs(ctx.message.text).args[0] || 0);
  if (!id) return ctx.reply("Usage: /group GROUP_ID");
  const g = await Group.findOne({ groupId: id });
  if (!g) return ctx.reply("Group not found.");
  await ctx.reply(
    `Group
ID: ${g.groupId}
Title: ${g.title}
Status: ${g.status}
Enabled: ${g.isEnabled}
Blacklisted: ${g.isBlacklisted}
Joined: ${formatDate(g.joinedAt)}`
  );
});

bot.command("leavegroup", async (ctx) => {
  const access = await accessGuard(ctx); if (!access.ok) return;
  if (!(await isAdmin(ctx.from.id))) return ctx.reply(t(access.lang, "noPerm"));
  const id = Number(splitArgs(ctx.message.text).args[0] || 0);
  if (!id) return ctx.reply("Usage: /leavegroup GROUP_ID");
  try { await bot.telegram.leaveChat(id); } catch {}
  await ctx.reply("Leave group requested.");
});

bot.command("blacklistgroup", async (ctx) => {
  const access = await accessGuard(ctx); if (!access.ok) return;
  if (!(await isAdmin(ctx.from.id))) return ctx.reply(t(access.lang, "noPerm"));
  const id = Number(splitArgs(ctx.message.text).args[0] || 0);
  if (!id) return ctx.reply("Usage: /blacklistgroup GROUP_ID");
  await Group.updateOne({ groupId: id }, { $set: { isBlacklisted: true } });
  await ctx.reply("Group blacklisted.");
});

bot.command("unblacklistgroup", async (ctx) => {
  const access = await accessGuard(ctx); if (!access.ok) return;
  if (!(await isAdmin(ctx.from.id))) return ctx.reply(t(access.lang, "noPerm"));
  const id = Number(splitArgs(ctx.message.text).args[0] || 0);
  if (!id) return ctx.reply("Usage: /unblacklistgroup GROUP_ID");
  await Group.updateOne({ groupId: id }, { $set: { isBlacklisted: false } });
  await ctx.reply("Group unblacklisted.");
});

// Stats/logs
bot.command("stats", async (ctx) => {
  const access = await accessGuard(ctx); if (!access.ok) return;
  if (!(await isAdmin(ctx.from.id))) return ctx.reply(t(access.lang, "noPerm"));
  const [users, groups, faqs, tickets, saved] = await Promise.all([
    User.countDocuments(),
    Group.countDocuments(),
    FAQ.countDocuments(),
    Ticket.countDocuments(),
    SavedContent.countDocuments(),
  ]);
  await ctx.reply(
    `📊 Stats

Users: ${users}
Groups: ${groups}
FAQ: ${faqs}
Tickets: ${tickets}
Saved: ${saved}`
  );
});

bot.command("logs", async (ctx) => {
  const access = await accessGuard(ctx); if (!access.ok) return;
  if (!(await isAdmin(ctx.from.id))) return ctx.reply(t(access.lang, "noPerm"));
  const rows = await Log.find().sort({ timestamp: -1 }).limit(20);
  if (!rows.length) return ctx.reply("No logs.");
  await ctx.reply(rows.map((x) => `• [${x.type}] ${x.action} | ${x.actorId} | ${formatDate(x.timestamp)}`).join("\n"));
});

bot.command("errorlogs", async (ctx) => {
  const access = await accessGuard(ctx); if (!access.ok) return;
  if (!(await isAdmin(ctx.from.id))) return ctx.reply(t(access.lang, "noPerm"));
  const rows = await Log.find({ type: "error" }).sort({ timestamp: -1 }).limit(20);
  if (!rows.length) return ctx.reply("No error logs.");
  await ctx.reply(rows.map((x) => `• ${x.action} | ${x.details}`).join("\n"));
});

bot.command("filterlogs", async (ctx) => {
  const access = await accessGuard(ctx); if (!access.ok) return;
  if (!(await isAdmin(ctx.from.id))) return ctx.reply(t(access.lang, "noPerm"));
  const rows = await Log.find({ type: "filter" }).sort({ timestamp: -1 }).limit(20);
  if (!rows.length) return ctx.reply("No filter logs.");
  await ctx.reply(rows.map((x) => `• ${x.details} | user:${x.actorId} | ${formatDate(x.timestamp)}`).join("\n"));
});

// Custom commands
bot.command("addcmd", async (ctx) => {
  const access = await accessGuard(ctx); if (!access.ok) return;
  if (!(await isAdmin(ctx.from.id))) return ctx.reply(t(access.lang, "noPerm"));
  const raw = cleanCmd(ctx.message.text, "addcmd");
  const parts = raw.split("|").map((x) => x.trim());
  if (parts.length < 2) return ctx.reply("Usage: /addcmd cmdname | response");
  const [cmd, response] = parts;
  await CustomCommand.findOneAndUpdate(
    { command: cmd.replace(/^\//, "").toLowerCase() },
    { $set: { type: "text", response_my: response, response_en: response, createdBy: ctx.from.id } },
    { upsert: true, new: true }
  );
  await ctx.reply("Custom command added.");
});

bot.command("editcmd", async (ctx) => {
  const access = await accessGuard(ctx); if (!access.ok) return;
  if (!(await isAdmin(ctx.from.id))) return ctx.reply(t(access.lang, "noPerm"));
  const raw = cleanCmd(ctx.message.text, "editcmd");
  const parts = raw.split("|").map((x) => x.trim());
  if (parts.length < 2) return ctx.reply("Usage: /editcmd cmdname | response");
  const [cmd, response] = parts;
  const row = await CustomCommand.findOne({ command: cmd.replace(/^\//, "").toLowerCase() });
  if (!row) return ctx.reply("Command not found.");
  row.response_my = response;
  row.response_en = response;
  await row.save();
  await ctx.reply("Custom command updated.");
});

bot.command("delcmd", async (ctx) => {
  const access = await accessGuard(ctx); if (!access.ok) return;
  if (!(await isAdmin(ctx.from.id))) return ctx.reply(t(access.lang, "noPerm"));
  const cmd = cleanCmd(ctx.message.text, "delcmd").replace(/^\//, "").toLowerCase();
  if (!cmd) return ctx.reply("Usage: /delcmd cmdname");
  await CustomCommand.deleteOne({ command: cmd });
  await ctx.reply("Custom command deleted.");
});

bot.command("cmdlist", async (ctx) => {
  const access = await accessGuard(ctx); if (!access.ok) return;
  if (!(await isAdmin(ctx.from.id))) return ctx.reply(t(access.lang, "noPerm"));
  const rows = await CustomCommand.find().sort({ createdAt: -1 }).limit(50);
  if (!rows.length) return ctx.reply("No custom commands.");
  await ctx.reply(rows.map((x) => `• /${x.command}`).join("\n"));
});

// Broadcast
async function doBroadcast(ctx, targetMode = "all") {
  const access = await accessGuard(ctx);
  if (!access.ok) return;
  if (!(await isAdmin(ctx.from.id))) return ctx.reply(t(access.lang, "noPerm"));
  if (!access.settings.broadcastEnabled) return ctx.reply(access.lang === "en" ? "Broadcast is disabled." : "Broadcast ပိတ်ထားပါတယ်။");
  const reply = ctx.message.reply_to_message;
  if (!reply) return ctx.reply("Reply to a message with /broadcast");

  let targets = [];
  if (targetMode === "users" || targetMode === "all") {
    const users = await User.find({ isBanned: false }).select("userId");
    targets.push(...users.map((u) => ({ id: u.userId, type: "user" })));
  }
  if (targetMode === "groups" || targetMode === "all") {
    const groups = await Group.find({ isEnabled: true, isBlacklisted: false, status: "approved" }).select("groupId");
    targets.push(...groups.map((g) => ({ id: g.groupId, type: "group" })));
  }

  const record = await Broadcast.create({
    type: "copy",
    targetMode,
    totalTargets: targets.length,
    successCount: 0,
    failCount: 0,
    startedBy: ctx.from.id,
    status: "running",
    sourceMessageId: reply.message_id,
    sourceChatId: ctx.chat.id,
  });

  let ok = 0;
  let fail = 0;
  for (const target of targets) {
    try {
      await ctx.telegram.copyMessage(target.id, ctx.chat.id, reply.message_id);
      ok++;
    } catch {
      fail++;
    }
  }

  record.successCount = ok;
  record.failCount = fail;
  record.status = "done";
  record.endedAt = now();
  await record.save();

  await ctx.reply(`Broadcast done.\nSuccess: ${ok}\nFail: ${fail}`);
}

bot.command("broadcast", async (ctx) => doBroadcast(ctx, "all"));
bot.command("broadcastusers", async (ctx) => doBroadcast(ctx, "users"));
bot.command("broadcastgroups", async (ctx) => doBroadcast(ctx, "groups"));
bot.command("broadcastall", async (ctx) => doBroadcast(ctx, "all"));

// ======================= OWNER COMMANDS =======================
bot.command("owner", async (ctx) => {
  const access = await accessGuard(ctx); if (!access.ok) return;
  if (!(await isOwner(ctx.from.id))) return ctx.reply(t(access.lang, "noPerm"));
  await ctx.reply(
    `👑 Owner Panel

/setadmin USER_ID
/deladmin USER_ID
/adminlist

/approve GROUP_ID
/reject GROUP_ID
/pendinggroups
/approvedgroups

/approvalmode on|off
/approvalstatus

/setbotname NAME
/maintenance on|off

/addfjoin @channel
/delfjoin @channel
/fjoinlist
/setfjoin on|off

/gfilter add WORD
/gfilter del WORD
/gfilters

/dbstats
/backup
/restore
/botstatus`
  );
});

bot.command("setadmin", async (ctx) => {
  const access = await accessGuard(ctx); if (!access.ok) return;
  if (!(await isOwner(ctx.from.id))) return ctx.reply(t(access.lang, "noPerm"));
  const id = Number(splitArgs(ctx.message.text).args[0] || 0);
  if (!id) return ctx.reply("Usage: /setadmin USER_ID");
  const u = await User.findOne({ userId: id });
  await Admin.findOneAndUpdate(
    { userId: id },
    {
      $set: {
        userId: id,
        name: `${u?.firstName || ""} ${u?.lastName || ""}`.trim(),
        username: u?.username || "",
        role: "admin",
        active: true,
        addedBy: ctx.from.id,
      },
    },
    { upsert: true, new: true }
  );
  await User.updateOne({ userId: id }, { $set: { role: "admin" } });
  await ctx.reply("Admin added.");
});

bot.command("deladmin", async (ctx) => {
  const access = await accessGuard(ctx); if (!access.ok) return;
  if (!(await isOwner(ctx.from.id))) return ctx.reply(t(access.lang, "noPerm"));
  const id = Number(splitArgs(ctx.message.text).args[0] || 0);
  if (!id) return ctx.reply("Usage: /deladmin USER_ID");
  await Admin.updateOne({ userId: id }, { $set: { active: false } });
  await User.updateOne({ userId: id }, { $set: { role: "user" } });
  await ctx.reply("Admin removed.");
});

bot.command("adminlist", async (ctx) => {
  const access = await accessGuard(ctx); if (!access.ok) return;
  if (!(await isOwner(ctx.from.id))) return ctx.reply(t(access.lang, "noPerm"));
  const rows = await Admin.find({ active: true });
  if (!rows.length) return ctx.reply("No active admins.");
  await ctx.reply(rows.map((x) => `• ${x.userId} ${x.name || ""} @${x.username || "-"}`).join("\n"));
});

// Approval system
bot.command("approve", async (ctx) => {
  const access = await accessGuard(ctx); if (!access.ok) return;
  if (!(await isOwner(ctx.from.id))) return ctx.reply(t(access.lang, "noPerm"));
  const gid = Number(splitArgs(ctx.message.text).args[0] || 0);
  if (!gid) return ctx.reply("Usage: /approve GROUP_ID");
  await Group.updateOne({ groupId: gid }, { $set: { status: "approved", approvedAt: now(), approvedBy: ctx.from.id, isEnabled: true } });
  await ctx.reply("Group approved.");
  try { await bot.telegram.sendMessage(gid, "✅ This group has been approved by owner."); } catch {}
});

bot.command("reject", async (ctx) => {
  const access = await accessGuard(ctx); if (!access.ok) return;
  if (!(await isOwner(ctx.from.id))) return ctx.reply(t(access.lang, "noPerm"));
  const gid = Number(splitArgs(ctx.message.text).args[0] || 0);
  if (!gid) return ctx.reply("Usage: /reject GROUP_ID");
  await Group.updateOne({ groupId: gid }, { $set: { status: "rejected", isEnabled: false } });
  await ctx.reply("Group rejected.");
  try {
    await bot.telegram.sendMessage(gid, "❌ This group has been rejected by owner.");
    await bot.telegram.leaveChat(gid);
  } catch {}
});

bot.command("pendinggroups", async (ctx) => {
  const access = await accessGuard(ctx); if (!access.ok) return;
  if (!(await isOwner(ctx.from.id))) return ctx.reply(t(access.lang, "noPerm"));
  const rows = await Group.find({ status: "pending" }).sort({ createdAt: -1 });
  if (!rows.length) return ctx.reply("No pending groups.");
  await ctx.reply(rows.map((g) => `• ${g.groupId} | ${g.title}`).join("\n"));
});

bot.command("approvedgroups", async (ctx) => {
  const access = await accessGuard(ctx); if (!access.ok) return;
  if (!(await isOwner(ctx.from.id))) return ctx.reply(t(access.lang, "noPerm"));
  const rows = await Group.find({ status: "approved" }).sort({ updatedAt: -1 }).limit(50);
  if (!rows.length) return ctx.reply("No approved groups.");
  await ctx.reply(rows.map((g) => `• ${g.groupId} | ${g.title}`).join("\n"));
});

// #24 Approval Mode Toggle
bot.command("approvalmode", async (ctx) => {
  const access = await accessGuard(ctx); if (!access.ok) return;
  if (!(await isOwner(ctx.from.id))) return ctx.reply(t(access.lang, "noPerm"));
  const state = onOff(splitArgs(ctx.message.text).args[0]);
  const settings = await getSettings();
  settings.approvalRequired = state;
  await settings.save();
  await ctx.reply(`Approval mode ${state ? "ON" : "OFF"}`);
});

bot.command("approvalstatus", async (ctx) => {
  const access = await accessGuard(ctx); if (!access.ok) return;
  if (!(await isOwner(ctx.from.id))) return ctx.reply(t(access.lang, "noPerm"));
  const settings = await getSettings();
  await ctx.reply(`Approval mode: ${settings.approvalRequired ? "ON" : "OFF"}`);
});

// Global settings
bot.command("setbotname", async (ctx) => {
  const access = await accessGuard(ctx); if (!access.ok) return;
  if (!(await isOwner(ctx.from.id))) return ctx.reply(t(access.lang, "noPerm"));
  const name = cleanCmd(ctx.message.text, "setbotname");
  if (!name) return ctx.reply("Usage: /setbotname NAME");
  const settings = await getSettings();
  settings.botName = name;
  await settings.save();
  await ctx.reply("Bot name updated.");
});

bot.command("maintenance", async (ctx) => {
  const access = await accessGuard(ctx); if (!access.ok) return;
  if (!(await isOwner(ctx.from.id))) return ctx.reply(t(access.lang, "noPerm"));
  const state = onOff(splitArgs(ctx.message.text).args[0]);
  const settings = await getSettings();
  settings.maintenanceMode = state;
  await settings.save();
  await ctx.reply(`Maintenance ${state ? "ON" : "OFF"}`);
});

// Force Join
bot.command("setfjoin", async (ctx) => {
  const access = await accessGuard(ctx); if (!access.ok) return;
  if (!(await isOwner(ctx.from.id))) return ctx.reply(t(access.lang, "noPerm"));
  const state = onOff(splitArgs(ctx.message.text).args[0]);
  const settings = await getSettings();
  settings.forceJoinEnabled = state;
  await settings.save();
  await ctx.reply(`Force Join ${state ? "ON" : "OFF"}`);
});

bot.command("addfjoin", async (ctx) => {
  const access = await accessGuard(ctx); if (!access.ok) return;
  if (!(await isOwner(ctx.from.id))) return ctx.reply(t(access.lang, "noPerm"));
  const channel = splitArgs(ctx.message.text).args[0];
  if (!channel) return ctx.reply("Usage: /addfjoin @channel");
  const settings = await getSettings();
  if (!settings.forceJoinChannels.includes(channel)) settings.forceJoinChannels.push(channel);
  await settings.save();
  await ctx.reply("Force join channel added.");
});

bot.command("delfjoin", async (ctx) => {
  const access = await accessGuard(ctx); if (!access.ok) return;
  if (!(await isOwner(ctx.from.id))) return ctx.reply(t(access.lang, "noPerm"));
  const channel = splitArgs(ctx.message.text).args[0];
  if (!channel) return ctx.reply("Usage: /delfjoin @channel");
  const settings = await getSettings();
  settings.forceJoinChannels = settings.forceJoinChannels.filter((x) => x !== channel);
  await settings.save();
  await ctx.reply("Force join channel removed.");
});

bot.command("fjoinlist", async (ctx) => {
  const access = await accessGuard(ctx); if (!access.ok) return;
  if (!(await isOwner(ctx.from.id))) return ctx.reply(t(access.lang, "noPerm"));
  const settings = await getSettings();
  await ctx.reply(`Force Join: ${settings.forceJoinEnabled ? "ON" : "OFF"}\n\n${settings.forceJoinChannels.join("\n") || "No channels."}`);
});

// DB / premium scaffold
bot.command("dbstats", async (ctx) => {
  const access = await accessGuard(ctx); if (!access.ok) return;
  if (!(await isOwner(ctx.from.id))) return ctx.reply(t(access.lang, "noPerm"));
  const counts = await Promise.all([
    User.countDocuments(),
    Group.countDocuments(),
    Admin.countDocuments(),
    FAQ.countDocuments(),
    Ticket.countDocuments(),
    SavedContent.countDocuments(),
    Filter.countDocuments(),
    Log.countDocuments(),
    Broadcast.countDocuments(),
    CustomCommand.countDocuments(),
  ]);
  await ctx.reply(
    `DB Stats

Users: ${counts[0]}
Groups: ${counts[1]}
Admins: ${counts[2]}
FAQ: ${counts[3]}
Tickets: ${counts[4]}
Saved: ${counts[5]}
Filters: ${counts[6]}
Logs: ${counts[7]}
Broadcasts: ${counts[8]}
CustomCmds: ${counts[9]}`
  );
});

bot.command("backup", async (ctx) => {
  const access = await accessGuard(ctx); if (!access.ok) return;
  if (!(await isOwner(ctx.from.id))) return ctx.reply(t(access.lang, "noPerm"));
  await ctx.reply("Backup scaffold ready. Use DB dump on server for full backup.");
});

bot.command("restore", async (ctx) => {
  const access = await accessGuard(ctx); if (!access.ok) return;
  if (!(await isOwner(ctx.from.id))) return ctx.reply(t(access.lang, "noPerm"));
  await ctx.reply("Restore scaffold ready. Use DB restore on server.");
});

bot.command("botstatus", async (ctx) => {
  const access = await accessGuard(ctx); if (!access.ok) return;
  if (!(await isOwner(ctx.from.id))) return ctx.reply(t(access.lang, "noPerm"));
  const settings = await getSettings();
  await ctx.reply(
    `Bot Status

Bot Name: ${settings.botName}
Maintenance: ${settings.maintenanceMode}
Approval Required: ${settings.approvalRequired}
Force Join: ${settings.forceJoinEnabled}
Global Filter: ${settings.globalFilterEnabled}
Broadcast: ${settings.broadcastEnabled}
Ticket: ${settings.ticketEnabled}`
  );
});

// ======================= CUSTOM COMMAND HANDLER =======================
bot.use(async (ctx, next) => {
  if (!ctx.message?.text || !ctx.message.text.startsWith("/")) return next();

  const { cmd } = splitArgs(ctx.message.text);
  const commandName = cmd.replace(/^\//, "").replace(/@.+$/, "").toLowerCase();
  const builtins = new Set([
    "start","help","about","ping","uptime","lang","id","userinfo","groupinfo",
    "faq","search","ticket","mytickets","closeticket","replyticket",
    "get","notes","saved",
    "mono","bold","underline","spoiler","reverse","upper","lower","calc","password","flip","choose","extractlink","time","translate","qr",
    "feedback","rate","referral","invite","fileid",
    "ghelp","groupsettings","approval","requestapprove","filter","filters","gfilter","gfilters",
    "cleanservices","cleanjoin","cleanleave","cleanpin","cleanvoice","cleantitle","cleanphoto","cleanstatus",
    "warn","warnings","clearwarns",
    "admin","admins","addfaq","editfaq","delfaq","faqlist","save","editsave","delsave","savedlist","tickets","opentickets","closedtickets","ticketreply","closeticketadmin","reopenticket","ban","unban","user","finduser","groups","group","leavegroup","blacklistgroup","unblacklistgroup","stats","logs","errorlogs","filterlogs","addcmd","editcmd","delcmd","cmdlist","broadcast","broadcastusers","broadcastgroups","broadcastall",
    "owner","setadmin","deladmin","adminlist","approve","reject","pendinggroups","approvedgroups","approvalmode","approvalstatus","setbotname","maintenance","setfjoin","addfjoin","delfjoin","fjoinlist","dbstats","backup","restore","botstatus"
  ]);
  if (builtins.has(commandName)) return next();

  const row = await CustomCommand.findOne({ command: commandName });
  if (!row) return next();

  const user = await ensureUser(ctx.from);
  const lang = await getLang(user);
  if (row.type === "text") {
    return ctx.reply(lang === "en" ? (row.response_en || row.response_my || "") : (row.response_my || row.response_en || ""));
  }
  if (row.type === "photo" && row.fileId) {
    return ctx.replyWithPhoto(row.fileId, { caption: lang === "en" ? (row.response_en || row.response_my || "") : (row.response_my || row.response_en || "") });
  }
  return next();
});

// ======================= MENU CALLBACKS =======================
bot.action("menu:main", async (ctx) => {
  const user = await ensureUser(ctx.from);
  const lang = await getLang(user);
  await ctx.editMessageText(t(lang, "start", ctx.from.first_name || "User"), { parse_mode: "HTML", ...mainMenu(lang) });
});

bot.action("menu:help", async (ctx) => {
  const user = await ensureUser(ctx.from);
  const lang = await getLang(user);
  await ctx.editMessageText(t(lang, "help") + "\n\n" + userToolsHelp(lang), backButtons(lang));
});

bot.action("menu:faq", async (ctx) => {
  const user = await ensureUser(ctx.from);
  const lang = await getLang(user);
  const rows = await FAQ.find({ status: "active" }).sort({ createdAt: -1 }).limit(10);
  const text = rows.length
    ? "📚 FAQ\n\n" + rows.map((r, i) => `${i + 1}. ${lang === "en" ? (r.question_en || r.question_my) : (r.question_my || r.question_en)}`).join("\n")
    : t(lang, "faqNone");
  await ctx.editMessageText(text, backButtons(lang));
});

bot.action("menu:search", async (ctx) => {
  const user = await ensureUser(ctx.from);
  const lang = await getLang(user);
  await ctx.editMessageText(lang === "en" ? "Use /search keyword" : "/search keyword ကိုသုံးပါ", backButtons(lang));
});

bot.action("menu:support", async (ctx) => {
  const user = await ensureUser(ctx.from);
  const lang = await getLang(user);
  await ctx.editMessageText(lang === "en" ? "Use /ticket in private chat." : "Private chat မှာ /ticket ကိုသုံးပါ", backButtons(lang));
});

bot.action("menu:tools", async (ctx) => {
  const user = await ensureUser(ctx.from);
  const lang = await getLang(user);
  await ctx.editMessageText(userToolsHelp(lang), backButtons(lang));
});

bot.action("menu:saved", async (ctx) => {
  const user = await ensureUser(ctx.from);
  const lang = await getLang(user);
  await ctx.editMessageText(lang === "en" ? "Use /get <keyword> or /notes" : "/get <keyword> သို့မဟုတ် /notes ကိုသုံးပါ", backButtons(lang));
});

bot.action("menu:lang", async (ctx) => {
  const user = await ensureUser(ctx.from);
  const lang = await getLang(user);
  await ctx.editMessageText(
    lang === "en" ? "Choose language" : "ဘာသာစကား ရွေးပါ",
    Markup.inlineKeyboard([
      [Markup.button.callback("မြန်မာ", "lang:set:my"), Markup.button.callback("English", "lang:set:en")],
      [Markup.button.callback(lang === "en" ? "⬅️ Back" : "⬅️ နောက်သို့", "menu:main")],
    ])
  );
});

bot.action(/^lang:set:(my|en)$/, async (ctx) => {
  const choice = ctx.match[1];
  const user = await ensureUser(ctx.from);
  user.language = choice;
  await user.save();
  await ctx.answerCbQuery(choice === "my" ? "ပြောင်းပြီးပါပြီ" : "Changed");
  await ctx.editMessageText(t(choice, "start", ctx.from.first_name || "User"), { parse_mode: "HTML", ...mainMenu(choice) });
});

bot.action("menu:about", async (ctx) => {
  const user = await ensureUser(ctx.from);
  const lang = await getLang(user);
  await ctx.editMessageText(t(lang, "about"), backButtons(lang));
});

bot.action("menu:contact", async (ctx) => {
  const user = await ensureUser(ctx.from);
  const lang = await getLang(user);
  await ctx.editMessageText(lang === "en" ? "Use /ticket to contact support." : "Support ဆက်သွယ်ရန် /ticket ကိုသုံးပါ", backButtons(lang));
});

bot.action("menu:recheck_fjoin", async (ctx) => {
  const access = await accessGuard(ctx);
  if (!access.ok) return;
  const ok = await forceJoinGuard(ctx, access.lang, access.settings);
  if (ok) await ctx.answerCbQuery(access.lang === "en" ? "Verified" : "စစ်ဆေးပြီးပါပြီ");
});

bot.action("menu:close", async (ctx) => {
  try { await ctx.deleteMessage(); } catch {}
});

// ======================= GROUP EVENT HOOKS =======================
bot.on("message", async (ctx) => {
  try {
    if (!ctx.message?.new_chat_members) return;

    const group = await ensureGroup(ctx.chat);
    const settings = await getSettings();
    const members = ctx.message.new_chat_members || [];
    if (!members.length) return;

    console.log("[WELCOME] join event in group:", ctx.chat?.id, ctx.chat?.title);

    const botJoined = members.some((x) => x.id === (ctx.botInfo?.id || 0));
    if (botJoined && settings.approvalRequired && group?.status === "pending") {
      try {
        await bot.telegram.sendMessage(
          OWNER_ID,
          `🆕 Bot added to new group

Group: ${ctx.chat.title}
Group ID: ${ctx.chat.id}
Status: pending

Approve:
 /approve ${ctx.chat.id}

Reject:
 /reject ${ctx.chat.id}`
        );
      } catch {}
    }

    const welcomeEnabled = group?.settings?.welcomeEnabled !== false;
    const welcomePhotoEnabled = group?.settings?.welcomePhotoEnabled !== false;
    const welcomeTextEnabled = group?.settings?.welcomeTextEnabled !== false;

    if (!welcomeEnabled) return;

    for (const member of members) {
      if (!member || member.is_bot) continue;

      const fullName = [member.first_name, member.last_name].filter(Boolean).join(" ").trim() || "User";
      const mention = member.username
        ? `@${member.username}`
        : `<a href="tg://user?id=${member.id}">${escapeHtml(fullName)}</a>`;
      const groupName = ctx.chat.title || "Group";

      const defaultText = `မင်္ဂလာပါ ${mention} ရေ

${escapeHtml(groupName)} မှ ကြိုဆိုပါတယ်

အချင်းချင်း စကားတွေပြောရင်း

ပျော်ရွှင်စရာနေ့ရက်တွေ ပိုင်ဆိုင်နိူင်ပါစေ`;

      if (welcomePhotoEnabled && typeof buildWelcomeImage === "function") {
        try {
          const avatarBuffer = await getUserAvatarBuffer(member.id);
            const buffer = await buildWelcomeImage(fullName, groupName, avatarBuffer);
          await ctx.replyWithPhoto(
            { source: buffer },
            {
              caption: welcomeTextEnabled ? defaultText : undefined,
              parse_mode: "HTML"
            }
          );
          console.log("[WELCOME] photo sent for:", fullName);
          continue;
        } catch (err) {
          console.log("[WELCOME] photo failed, fallback to text:", err?.message || err);
        }
      }

      if (welcomeTextEnabled) {
        await ctx.replyWithHTML(defaultText);
        console.log("[WELCOME] text sent for:", fullName);
      }
    }
  } catch (err) {
    console.error("welcome handler error:", err);
  }
});

// ======================= GLOBAL ERROR =======================
bot.catch(async (err, ctx) => {
  console.error("Bot catch:", err);
  try {
    await writeLog("error", ctx?.from?.id || 0, ctx?.from?.first_name || "", "bot_catch", String(err.message || err), "", "", ctx?.chat?.id || 0);
    await ctx.reply("An error occurred.");
  } catch {}
});

// ======================= BOOT =======================
(async () => {
  const settings = await getSettings();
  console.log(`🚀 Starting ${settings.botName} ...`);
  await bot.launch();
  console.log("✅ Bot started with polling");
})();

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
