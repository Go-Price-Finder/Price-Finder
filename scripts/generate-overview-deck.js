const pptxgen = require("pptxgenjs");

const NAVY = "2F3C7E";
const CORAL = "F96167";
const GOLD = "F9E795";
const WHITE = "FFFFFF";
const DARKTEXT = "2B2B2B";
const MUTED = "6B6B76";
const CARDBG = "FFF9EC";

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.3 x 7.5
const PW = 13.33, PH = 7.5;

function titleBar(slide, kicker, title) {
  slide.addText(kicker.toUpperCase(), {
    x: 0.6, y: 0.45, w: 8, h: 0.35, fontFace: "Calibri", fontSize: 13,
    bold: true, color: CORAL, charSpacing: 2,
  });
  slide.addText(title, {
    x: 0.6, y: 0.78, w: 11.5, h: 0.8, fontFace: "Cambria", fontSize: 32,
    bold: true, color: NAVY,
  });
}

function pageNum(slide, n) {
  slide.addText(String(n), {
    x: PW - 0.9, y: PH - 0.55, w: 0.5, h: 0.35, fontFace: "Calibri",
    fontSize: 11, color: MUTED, align: "right",
  });
}

function card(slide, x, y, w, h, opts = {}) {
  slide.addShape("roundRect", {
    x, y, w, h, rectRadius: 0.12,
    fill: { color: opts.fill || CARDBG },
    line: { color: opts.line || "EDE3CC", width: 1 },
    shadow: { type: "outer", color: "000000", opacity: 0.12, blur: 8, offset: 3, angle: 90 },
  });
}

function circleNum(slide, x, y, d, text, bg, color) {
  slide.addShape("ellipse", { x, y, w: d, h: d, fill: { color: bg }, line: { type: "none" } });
  slide.addText(text, {
    x, y, w: d, h: d, align: "center", valign: "middle",
    fontFace: "Calibri", bold: true, fontSize: d > 0.7 ? 20 : 16, color,
  });
}

// ---------- Slide 1: Title ----------
{
  const s = pres.addSlide();
  s.background = { color: NAVY };
  s.addShape("ellipse", { x: 10.2, y: -1.8, w: 5.5, h: 5.5, fill: { color: CORAL, transparency: 82 }, line: { type: "none" } });
  s.addShape("ellipse", { x: -1.5, y: 4.8, w: 4.5, h: 4.5, fill: { color: GOLD, transparency: 85 }, line: { type: "none" } });

  s.addText("PRICE FINDER", {
    x: 0.9, y: 2.6, w: 11.5, h: 0.5, fontFace: "Calibri", fontSize: 15,
    bold: true, color: GOLD, charSpacing: 3,
  });
  s.addText("Helping People Find\nthe Best Prices, Automatically", {
    x: 0.9, y: 3.05, w: 11, h: 1.9, fontFace: "Cambria", fontSize: 40,
    bold: true, color: WHITE, lineSpacing: 46,
  });
  s.addText("A simple walkthrough of what we're building, why it matters,\nand how we work together as a team.", {
    x: 0.9, y: 5.0, w: 10, h: 0.9, fontFace: "Calibri", fontSize: 15,
    color: "D7DBEE", lineSpacing: 22,
  });
  s.addText("Prepared for the Price Finder team  •  August 2026", {
    x: 0.9, y: 6.75, w: 8, h: 0.4, fontFace: "Calibri", fontSize: 11, color: "9AA2C7",
  });
}

// ---------- Slide 2: What is Price Finder ----------
{
  const s = pres.addSlide();
  titleBar(s, "The Basics", "What Is Price Finder?");

  s.addText(
    "Price Finder is a website. People come to it before they buy something online — " +
    "so they can see the price at different stores, all in one place, and pick the cheapest one.",
    { x: 0.6, y: 1.75, w: 6.1, h: 1.6, fontFace: "Calibri", fontSize: 16, color: DARKTEXT, lineSpacing: 24 }
  );

  s.addText("Think of it like a helpful friend who already checked every store for you.", {
    x: 0.6, y: 3.45, w: 6.1, h: 0.9, fontFace: "Cambria", italic: true, fontSize: 16, color: NAVY, lineSpacing: 22,
  });

  const items = [
    ["Compare prices", "See the same product's price at many stores, side by side."],
    ["Track price history", "See if a price is high or low right now, and if it dropped recently."],
    ["Get price alerts", "Get notified automatically when a price drops."],
  ];
  let y = 1.75;
  items.forEach((it, i) => {
    circleNum(s, 7.1, y, 0.5, String(i + 1), CORAL, WHITE);
    s.addText(it[0], { x: 7.8, y: y - 0.05, w: 4.6, h: 0.4, fontFace: "Calibri", bold: true, fontSize: 15, color: NAVY });
    s.addText(it[1], { x: 7.8, y: y + 0.32, w: 4.7, h: 0.7, fontFace: "Calibri", fontSize: 12.5, color: MUTED, lineSpacing: 17 });
    y += 1.25;
  });

  pageNum(s, 2);
}

// ---------- Slide 3: Why we're building it ----------
{
  const s = pres.addSlide();
  titleBar(s, "The Opportunity", "Why We're Building This");

  const stats = [
    ["1M+", "products we want\nto eventually cover"],
    ["10+", "categories, from\nelectronics to home goods"],
    ["$0", "extra cost to the\nshopper — it's free to use"],
  ];
  let x = 0.6;
  stats.forEach((st) => {
    card(s, x, 1.9, 3.85, 1.9, { fill: NAVY, line: NAVY });
    s.addText(st[0], { x: x, y: 2.05, w: 3.85, h: 0.85, align: "center", fontFace: "Cambria", bold: true, fontSize: 40, color: GOLD });
    s.addText(st[1], { x: x + 0.2, y: 2.95, w: 3.45, h: 0.7, align: "center", fontFace: "Calibri", fontSize: 12, color: "E4E8FA", lineSpacing: 15 });
    x += 4.15;
  });

  s.addText(
    "People overspend every day simply because checking every store by hand is too slow. " +
    "We built a site that does that checking automatically — and every time someone buys through us, " +
    "the store pays Price Finder a small fee. The shopper pays nothing extra.",
    { x: 0.6, y: 4.25, w: 11.9, h: 1.5, fontFace: "Calibri", fontSize: 16, color: DARKTEXT, lineSpacing: 25 }
  );

  s.addText("This is exactly how well-known sites like camelcamelcamel and price.com make money.", {
    x: 0.6, y: 5.85, w: 11.9, h: 0.5, fontFace: "Calibri", italic: true, fontSize: 13, color: MUTED,
  });

  pageNum(s, 3);
}

// ---------- Slide 4: What we've built so far ----------
{
  const s = pres.addSlide();
  titleBar(s, "Progress", "What We've Already Built");

  const done = [
    ["Website design", "A clean, modern site — easy to use on phone or computer."],
    ["Live prices", "Prices update automatically every day from our store partners."],
    ["Price history & alerts", "Every product now shows if today's price is a good deal."],
    ["First store partners", "We've signed up real stores and their products are live."],
  ];
  let x = 0.6, y = 1.9;
  done.forEach((d, i) => {
    const cx = x + (i % 2) * 6.1;
    const cy = y + Math.floor(i / 2) * 2.05;
    card(s, cx, cy, 5.75, 1.75, { fill: WHITE, line: "EAEAF2" });
    s.addShape("ellipse", { x: cx + 0.25, y: cy + 0.25, w: 0.55, h: 0.55, fill: { color: GOLD }, line: { type: "none" } });
    s.addText("✓", { x: cx + 0.25, y: cy + 0.25, w: 0.55, h: 0.55, align: "center", valign: "middle", fontFace: "Calibri", bold: true, fontSize: 20, color: NAVY });
    s.addText(d[0], { x: cx + 1.0, y: cy + 0.2, w: 4.5, h: 0.4, fontFace: "Calibri", bold: true, fontSize: 15, color: NAVY });
    s.addText(d[1], { x: cx + 1.0, y: cy + 0.62, w: 4.55, h: 1.0, fontFace: "Calibri", fontSize: 12, color: MUTED, lineSpacing: 16 });
  });

  pageNum(s, 4);
}

// ---------- Slide 5: What's coming next ----------
{
  const s = pres.addSlide();
  titleBar(s, "Looking Ahead", "What's Coming Next");

  const steps = [
    ["Sign up more stores", "So Price Finder has more products to compare, in more categories."],
    ["Move our catalog to a real database", "So the site can handle way more products without slowing down."],
    ["Build cash back", "Give shoppers money back for buying through Price Finder."],
    ["Add new categories", "Like gift cards and hotels, growing beyond today's stores."],
  ];
  let y = 1.85;
  steps.forEach((st, i) => {
    circleNum(s, 0.6, y, 0.55, String(i + 1), i === 0 ? CORAL : "EDEDF4", i === 0 ? WHITE : NAVY);
    s.addText(st[0], { x: 1.4, y: y - 0.03, w: 5.4, h: 0.4, fontFace: "Calibri", bold: true, fontSize: 15, color: NAVY });
    s.addText(st[1], { x: 1.4, y: y + 0.36, w: 5.5, h: 0.65, fontFace: "Calibri", fontSize: 12, color: MUTED, lineSpacing: 15 });
    if (i < steps.length - 1) {
      s.addShape("line", { x: 0.875, y: y + 0.6, w: 0, h: 0.6, line: { color: "D8D8E6", width: 1.5, dashType: "dash" } });
    }
    y += 1.2;
  });

  card(s, 7.2, 1.85, 5.5, 4.6, { fill: NAVY, line: NAVY });
  s.addText("Why this order?", { x: 7.6, y: 2.15, w: 4.8, h: 0.4, fontFace: "Calibri", bold: true, fontSize: 15, color: GOLD });
  s.addText(
    "We're growing the number of stores and products first. Once we have more products, " +
    "we need a stronger database so the site stays fast. Cash back and new categories come " +
    "after that foundation is solid — building in this order means we don't have to redo work later.",
    { x: 7.6, y: 2.65, w: 4.75, h: 2.4, fontFace: "Calibri", fontSize: 13, color: "E4E8FA", lineSpacing: 20 }
  );

  pageNum(s, 5);
}

// ---------- Slide 6: How we work together ----------
{
  const s = pres.addSlide();
  titleBar(s, "Teamwork", "How We Work Together");

  const cols = [
    ["The Website Code", "Lives on GitHub — a place where all the website's files are stored and updated. Any changes get saved there."],
    ["The Plans & Notes", "Kept in a shared Claude \"Project\" — like a shared notebook with our goals, research, and to-do lists."],
    ["Building New Things", "Claude (an AI helper) writes and updates the website's code for us, based on what we ask it to do."],
  ];
  let x = 0.6;
  cols.forEach((c) => {
    card(s, x, 1.85, 3.95, 4.6, { fill: WHITE, line: "EAEAF2" });
    s.addShape("roundRect", { x: x + 0.35, y: 2.15, w: 0.7, h: 0.7, rectRadius: 0.14, fill: { color: GOLD }, line: { type: "none" } });
    s.addText(c[0], { x: x + 0.35, y: 3.1, w: 3.3, h: 0.7, fontFace: "Calibri", bold: true, fontSize: 15.5, color: NAVY, lineSpacing: 19 });
    s.addText(c[1], { x: x + 0.35, y: 3.85, w: 3.3, h: 2.4, fontFace: "Calibri", fontSize: 12.5, color: MUTED, lineSpacing: 18 });
    x += 4.25;
  });

  pageNum(s, 6);
}

// ---------- Slide 7: Using Claude Team (dedicated section) ----------
{
  const s = pres.addSlide();
  s.background = { color: NAVY };
  s.addText("A SPECIAL SECTION", { x: 0.6, y: 0.5, w: 8, h: 0.35, fontFace: "Calibri", fontSize: 13, bold: true, color: GOLD, charSpacing: 2 });
  s.addText("How To Use Claude Team", { x: 0.6, y: 0.85, w: 11, h: 0.8, fontFace: "Cambria", bold: true, fontSize: 32, color: WHITE });
  s.addText("The tool we use to plan, ask questions, and build the website together.", {
    x: 0.6, y: 1.55, w: 10.5, h: 0.5, fontFace: "Calibri", fontSize: 14, color: "C9CEEB",
  });

  const rows = [
    ["What is it?", "A shared account where our whole team can talk to Claude (an AI assistant) and see the same notes, plans, and history — everyone sees the same information."],
    ["What do I do with it?", "You just type in plain English what you want to know or want built — like texting a very capable assistant. No coding needed."],
    ["Where do I find our project?", "Once you're invited to the team, open the \"Price Finder\" Project. All our research, plans, and progress are saved there — read them any time."],
    ["What about the actual code?", "That's separate — it lives on GitHub, not in Claude Team. You'll get your own GitHub access too, so both of us can update the real website."],
  ];
  let y = 2.25;
  rows.forEach((r) => {
    s.addShape("roundRect", { x: 0.6, y, w: 12.1, h: 1.05, rectRadius: 0.1, fill: { color: "3A4690" }, line: { type: "none" } });
    s.addText(r[0], { x: 0.95, y: y + 0.1, w: 3.1, h: 0.85, valign: "middle", fontFace: "Calibri", bold: true, fontSize: 13.5, color: GOLD, lineSpacing: 16 });
    s.addText(r[1], { x: 4.2, y: y + 0.08, w: 8.3, h: 0.9, valign: "middle", fontFace: "Calibri", fontSize: 12.5, color: "EDEFF9", lineSpacing: 16 });
    y += 1.16;
  });

  s.addText("7", { x: PW - 0.9, y: PH - 0.5, w: 0.5, h: 0.35, fontFace: "Calibri", fontSize: 11, color: "9AA2C7", align: "right" });
}

// ---------- Slide 8: Closing ----------
{
  const s = pres.addSlide();
  s.background = { color: NAVY };
  s.addShape("ellipse", { x: 9.8, y: 3.5, w: 6, h: 6, fill: { color: CORAL, transparency: 85 }, line: { type: "none" } });

  s.addText("Let's Build This Together", {
    x: 0.9, y: 2.7, w: 11, h: 1, fontFace: "Cambria", bold: true, fontSize: 38, color: WHITE,
  });
  s.addText(
    "One place to compare prices, built one step at a time. If anything here doesn't make\n" +
    "sense, just ask — that's exactly what Claude Team is there for.",
    { x: 0.9, y: 3.75, w: 10.5, h: 1, fontFace: "Calibri", fontSize: 15, color: "D7DBEE", lineSpacing: 22 }
  );
  s.addText("Questions? Just ask.", {
    x: 0.9, y: 5.6, w: 8, h: 0.5, fontFace: "Calibri", italic: true, fontSize: 14, color: GOLD,
  });
}

pres.writeFile({ fileName: "/tmp/pf-slides/PriceFinder-Overview.pptx" }).then(() => {
  console.log("done");
});
