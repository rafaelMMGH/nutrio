import type { Locator, Page } from "@playwright/test";
import { MAX_MESSAGE } from "../../src/lib/assistant";
import { expectIssues } from "./fixtures";
import { auditNow, visit } from "./theme-audit";
import { contrast, effectiveBackground, toRgb, type Theme } from "./theme-helpers";
import { assistantUi, focusWalk, buildAnswer, cartAnswer, createChatUser, deleteChatUser, expect, LINK_HREF, LINK_LABEL, LONG_LEAD, longLeadAnswer, mockChat, openAssistant, optionsAnswer, test, traceTyping, waitForTyping } from "./assistant-helpers";

// How the assistant looks and moves. Spec assistant-chat-polish, US5: REQ-14 (contrast in both themes, forced colors),
// REQ-16 (motion) and the "Look" details (bubble width, long tokens, no horizontal overflow at 360 px).
// The modal backdrop is audited in assistant-a11y.spec.ts.

test.beforeAll(() => createChatUser("look"));
test.afterAll(() => deleteChatUser());

const THEMES: Theme[] = ["light", "dark"];
const QUESTION = "¿Qué tengo en mi carrito?";
const FAILED_500 = [/POST \/api\/rag\/chat → 500/, /Failed to load resource.*500/];

async function ask(page: Page, message: string) {
  const ui = assistantUi(page);
  await ui.input.fill(message);
  await ui.send.click();
}

/** The whole panel (header, log, composer), not only the log: the subtitle, placeholder and field border count too. */
const audit = (page: Page) => auditNow(page, { scope: ".assistant-chat", tab: false, hover: true });

for (const theme of THEMES) {
  test.describe(`REQ-14: contrast in the ${theme} theme`, () => {
    test("empty thread, counter over the limit, answer, scroll button and focus rings", async ({ chat }) => {
      test.setTimeout(180_000);
      await mockChat(chat, { ...cartAnswer(8), sources: ["Carrito actual"] });
      await visit(chat, "/", theme);
      const ui = await openAssistant(chat);

      // Empty: subtitle, starter chips, placeholder, border of the field, send disabled.
      await expect(ui.chips.first()).toBeVisible();
      await expect(ui.send).toBeDisabled();
      let result = await audit(chat);
      expect(result.violations, "empty thread").toEqual([]);

      // The counter over its limit.
      await ui.input.fill("a".repeat(MAX_MESSAGE + 1));
      await expect(chat.locator(".assistant-counter.over")).toBeVisible();
      result = await audit(chat);
      expect(result.violations, "counter over the limit").toEqual([]);
      await ui.input.fill("");

      // Answers with chips and sources, Nueva conversación and the user bubble; the log overflows after a few.
      for (let turn = 1; turn <= 4; turn++) {
        await ask(chat, QUESTION);
        await expect(ui.assistantTurns).toHaveCount(turn);
      }
      await expect(ui.chips).toHaveCount(2);
      await expect(ui.assistantTurns.last().locator(".assistant-turn-sources")).toBeVisible();
      result = await audit(chat);
      expect(result.violations, "answer").toEqual([]);

      // Scrolled up: the scroll button shows over the log.
      await ui.log.evaluate((node) => node.scrollTo({ top: 0, behavior: "instant" }));
      await expect(chat.locator(".assistant-scroll.visible")).toBeVisible();
      result = await audit(chat);
      expect(result.violations, "scroll button").toEqual([]);

      // Typed text (not the placeholder) and send enabled.
      await ui.input.fill("hola");
      await expect(ui.send).toBeEnabled();
      result = await audit(chat);
      expect(result.violations, "send enabled").toEqual([]);

      expect(await focusWalk(chat, theme)).toEqual([]);
    });

    test("pending", async ({ chat }) => {
      await mockChat(chat, cartAnswer(), { hold: true });
      await visit(chat, "/", theme);
      const ui = await openAssistant(chat);
      await ask(chat, QUESTION);
      await expect(ui.pending).toContainText("Pensando");
      const { violations } = await audit(chat);
      expect(violations).toEqual([]);
    });

    test.describe("an error", () => {
      test.use({ expectedIssues: expectIssues(...FAILED_500) });

      test("the error text, Reintentar and the focus on it", async ({ chat }) => {
        await mockChat(chat, cartAnswer(), { status: 500 });
        await visit(chat, "/", theme);
        const ui = await openAssistant(chat);
        await ask(chat, QUESTION);
        await expect(chat.getByRole("button", { name: "Reintentar" })).toBeVisible();
        const { violations } = await audit(chat);
        expect(violations).toEqual([]);
        expect(await focusWalk(chat, theme)).toEqual([]);
        await expect(ui.assistantTurns).toHaveCount(1);
      });
    });
  });
}

test.describe("REQ-14: forced colors", () => {
  test.use({ forcedColors: "active" });

  test("highlights keep weight 600 or more, or an underline", async ({ chat }) => {
    await mockChat(chat, cartAnswer(3));
    await chat.goto("/");
    const ui = await openAssistant(chat);
    await ask(chat, QUESTION);
    await expect(ui.assistantTurns).toHaveCount(1);
    expect(await chat.evaluate(() => matchMedia("(forced-colors: active)").matches)).toBe(true);
    const marks = ui.assistantTurns.locator("strong");
    expect(await marks.count()).toBeGreaterThan(0);
    for (const mark of await marks.all()) {
      const { weight, underline } = await mark.evaluate((node) => ({ weight: parseInt(getComputedStyle(node).fontWeight, 10), underline: getComputedStyle(node).textDecorationLine }));
      expect(weight >= 600 || underline.includes("underline")).toBe(true);
      // The default bold alone would pass the line above; the underline is the rule this CSS adds.
      expect(underline).toContain("underline");
    }
  });

  test("the field keeps its border and it turns to Highlight on focus", async ({ chat }) => {
    await chat.goto("/");
    const ui = await openAssistant(chat);
    const form = chat.locator(".assistant-chat-form");
    expect(await form.evaluate((node) => parseFloat(getComputedStyle(node).borderTopWidth))).toBeGreaterThan(0);
    await ui.input.focus();
    const highlight = await chat.evaluate(() => {
      const probe = document.createElement("span");
      probe.style.color = "Highlight";
      document.body.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    });
    expect(await form.evaluate((node) => getComputedStyle(node).borderTopColor)).toBe(highlight);
  });

  test("the bubbles keep an edge when the system drops their fills", async ({ chat }) => {
    await mockChat(chat, cartAnswer(3));
    await chat.goto("/");
    const ui = await openAssistant(chat);
    await ask(chat, QUESTION);
    await expect(ui.assistantTurns).toHaveCount(1);
    // The bubble sits inside the full-width turn row, so the edge is the bubble's. The base border is 1px transparent, so
    // the width alone proves nothing: the edge must be painted, i.e. opaque (forced colors swaps it for a system color).
    for (const turn of [ui.userTurns.first().locator(".assistant-bubble"), ui.assistantTurns.first().locator(".assistant-bubble")]) {
      expect(await turn.evaluate((node) => parseFloat(getComputedStyle(node).borderTopWidth))).toBeGreaterThan(0);
      expect((await colorOf(chat, turn, "borderTopColor"))[3], "the edge is painted").toBe(1);
    }
  });
});

test.describe("REQ-16: motion", () => {
  /** Computed animation and transition of an element: names and the longest duration, in ms. */
  const motionOf = (locator: ReturnType<Page["locator"]>) =>
    locator.first().evaluate((node) => {
      const cs = getComputedStyle(node);
      const ms = (list: string) => Math.max(...list.split(",").map((part) => parseFloat(part) * (part.trim().endsWith("ms") ? 1 : 1000)));
      return { animation: cs.animationName, animationMs: ms(cs.animationDuration), transitionMs: ms(cs.transitionDuration) };
    });

  test.describe("reduced", () => {
    test.use({ reducedMotion: "reduce" });

    test("turns, loader, panel, scroll button and chips have no animation or transition, and the scroll is instant", async ({ chat }) => {
      const mock = await mockChat(chat, cartAnswer(8), { hold: true });
      await chat.goto("/");
      const ui = assistantUi(chat);
      expect(await motionOf(ui.panel)).toMatchObject({ animation: "none", transitionMs: 0 });
      await openAssistant(chat);
      expect(await motionOf(ui.panel)).toMatchObject({ animation: "none", transitionMs: 0 });
      expect(await motionOf(ui.chips)).toMatchObject({ animation: "none", transitionMs: 0 });

      await ask(chat, QUESTION);
      await expect(ui.pending).toContainText("Pensando");
      expect(await motionOf(ui.pending)).toMatchObject({ animation: "none", transitionMs: 0 });
      expect(await motionOf(ui.userTurns)).toMatchObject({ animation: "none", transitionMs: 0 });
      expect(await motionOf(chat.locator(".assistant-loader"))).toMatchObject({ animation: "none" });
      expect(await motionOf(chat.locator(".assistant-scroll"))).toMatchObject({ animation: "none", transitionMs: 0 });

      // A settled answer, the FAB and the composer buttons too.
      mock.release();
      await expect(ui.assistantTurns).toHaveCount(1);
      expect(await motionOf(ui.assistantTurns)).toMatchObject({ animation: "none", transitionMs: 0 });
      expect(await motionOf(ui.fab)).toMatchObject({ animation: "none", transitionMs: 0 });
      expect(await motionOf(chat.locator(".assistant-chat-form button"))).toMatchObject({ animation: "none", transitionMs: 0 });
    });

    test("the log is at the target right after a send and right after Ir al último mensaje", async ({ chat }) => {
      await mockChat(chat, cartAnswer(8), { delayMs: 300 });
      await chat.goto("/");
      const ui = await openAssistant(chat);
      for (let turn = 1; turn <= 3; turn++) {
        await ask(chat, QUESTION);
        await expect(ui.assistantTurns).toHaveCount(turn);
      }
      expect(await ui.log.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
      const gap = () => ui.log.evaluate((node) => node.scrollHeight - node.scrollTop - node.clientHeight);

      // Read straight after the click, with no polling: the question and the pending turn are in view at once.
      await ui.log.evaluate((node) => node.scrollTo({ top: 0, behavior: "instant" }));
      await ui.input.fill(QUESTION);
      await ui.send.click();
      expect(await gap()).toBeLessThanOrEqual(1);
      await expect(ui.assistantTurns).toHaveCount(4);

      await ui.log.evaluate((node) => node.scrollTo({ top: 0, behavior: "instant" }));
      await expect(chat.locator(".assistant-scroll.visible")).toBeVisible();
      await chat.getByRole("button", { name: "Ir al último mensaje" }).click();
      expect(await gap()).toBeLessThanOrEqual(1);
    });
  });

  test("without reduced motion a message fades in within 200 ms", async ({ chat }) => {
    await mockChat(chat, cartAnswer(3));
    await chat.goto("/");
    const ui = await openAssistant(chat);
    await ask(chat, QUESTION);
    await expect(ui.assistantTurns).toHaveCount(1);
    for (const turn of [ui.userTurns, ui.assistantTurns]) {
      const motion = await motionOf(turn);
      expect(motion.animation).not.toBe("none");
      expect(motion.animationMs).toBeGreaterThan(0);
      expect(motion.animationMs).toBeLessThanOrEqual(200);
    }
  });
});

test.describe("Look: width and long tokens at 360 px", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test("the user bubble is at most 80% wide, long tokens wrap and nothing overflows sideways", async ({ chat }) => {
    const token = "x".repeat(300);
    await mockChat(chat, buildAnswer({ lead: [{ text: `Resultado ${token}` }], sections: [{ title: "Ingredientes", items: [[{ text: token }]] }] }));
    await chat.goto("/");
    const ui = await openAssistant(chat);
    await ask(chat, `pregunta ${token}`);
    await expect(ui.assistantTurns).toHaveCount(1);

    const widths = await chat.evaluate(() => {
      const log = document.querySelector(".assistant-chat-log") as HTMLElement;
      const style = getComputedStyle(log);
      const content = log.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const user = (document.querySelector(".assistant-turn.user .assistant-bubble") as HTMLElement).getBoundingClientRect().width;
      return { content, user, logOverflow: log.scrollWidth - log.clientWidth, page: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    // The spec says "80% of the log width"; read as 80% of the log's content box (clientWidth minus padding).
    expect(widths.user).toBeLessThanOrEqual(widths.content * 0.8 + 0.5);
    expect(widths.logOverflow).toBeLessThanOrEqual(0);
    expect(widths.page).toBeLessThanOrEqual(0);
    expect(await chat.locator(".assistant-chat").evaluate((node) => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// assistant-data-scope US6 (REQ-32, REQ-35): bubbles, avatar, the arrow icon. Written before T056; first run in Batch E.

/** A computed color property of `locator` as sRGB. */
async function colorOf(page: Page, locator: Locator, property: "color" | "stroke" | "borderTopColor") {
  return toRgb(page, await locator.evaluate((node, name) => getComputedStyle(node)[name], property));
}

/**
 * Boundary contrast against `against`: the better of the fill and an opaque, visible border. Interpretation: the better of
 * fill vs opaque border against the log (WCAG 1.4.11 reading); the border must be opaque, `edge[3] === 1`.
 */
async function boundary(page: Page, locator: Locator, against: [number, number, number, number]) {
  const fill = contrast(await effectiveBackground(locator), against);
  const width = await locator.evaluate((node) => parseFloat(getComputedStyle(node).borderTopWidth));
  const edge = await colorOf(page, locator, "borderTopColor");
  return Math.max(fill, width > 0 && edge[3] === 1 ? contrast(edge, against) : 0);
}

test.describe("REQ-32: sides and avatar", () => {
  test("the question is right-aligned without an avatar; the answer is left-aligned with a hidden 32 px Bot avatar and spans the rest", async ({ chat }) => {
    await mockChat(chat, optionsAnswer());
    await chat.goto("/");
    const ui = await openAssistant(chat);
    await ask(chat, QUESTION);
    await expect(ui.assistantTurns).toHaveCount(1);

    await expect(ui.userTurns.locator(".assistant-avatar")).toHaveCount(0);
    await expect(ui.avatars).toHaveCount(1);
    const avatar = ui.avatars.first();
    await expect(avatar).toHaveAttribute("aria-hidden", "true");
    await expect(avatar.locator("svg.lucide-bot")).toHaveCount(1);

    const geometry = await chat.evaluate(() => {
      const log = document.querySelector(".assistant-chat-log") as HTMLElement;
      const style = getComputedStyle(log);
      const rect = log.getBoundingClientRect();
      const inner = { left: rect.left + log.clientLeft + parseFloat(style.paddingLeft), right: rect.left + log.clientLeft + log.clientWidth - parseFloat(style.paddingRight) };
      const box = (selector: string) => (document.querySelector(selector) as HTMLElement).getBoundingClientRect();
      const avatar = document.querySelector(".assistant-turn .assistant-avatar") as HTMLElement;
      return { inner, user: box(".assistant-turn.user .assistant-bubble"), bubble: box(".assistant-turn.assistant .assistant-bubble"), avatar: avatar.getBoundingClientRect(), radius: getComputedStyle(avatar).borderTopLeftRadius };
    });
    expect(Math.abs(geometry.user.right - geometry.inner.right)).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.avatar.left - geometry.inner.left)).toBeLessThanOrEqual(1);
    expect(geometry.avatar.width).toBeCloseTo(32, 0);
    expect(geometry.avatar.height).toBeCloseTo(32, 0);
    // Circular: 50%, or a pixel radius of at least half the 32 px side.
    expect(geometry.radius === "50%" || (geometry.radius.endsWith("px") && parseFloat(geometry.radius) >= 16), `radius ${geometry.radius}`).toBe(true);
    // The bubble starts after the avatar and runs to the right edge of the log.
    expect(geometry.bubble.left).toBeGreaterThanOrEqual(geometry.avatar.right - 0.5);
    expect(Math.abs(geometry.bubble.right - geometry.inner.right)).toBeLessThanOrEqual(1);
  });

  test.describe("an error", () => {
    test.use({ expectedIssues: expectIssues(...FAILED_500) });

    test("the error bubble has the avatar too", async ({ chat }) => {
      await mockChat(chat, cartAnswer(), { status: 500 });
      await chat.goto("/");
      const ui = await openAssistant(chat);
      await ask(chat, QUESTION);
      await expect(chat.getByRole("button", { name: "Reintentar" })).toBeVisible();
      await expect(ui.avatars).toHaveCount(1);
      await expect(ui.avatars.first()).toHaveAttribute("aria-hidden", "true");
      await expect(ui.avatars.first().locator("svg.lucide-bot")).toHaveCount(1);
    });
  });
});

for (const theme of THEMES) {
  test.describe(`REQ-32, REQ-35: bubble, avatar and arrow contrast in the ${theme} theme`, () => {
    test("text 4.5:1, boundaries and the arrow 3:1, and the audit finds nothing", async ({ chat }) => {
      test.setTimeout(180_000);
      await mockChat(chat, optionsAnswer());
      await visit(chat, "/", theme);
      const ui = await openAssistant(chat);
      await ask(chat, QUESTION);
      await expect(ui.assistantTurns).toHaveCount(1);

      const log = await effectiveBackground(ui.log);
      for (const [name, bubble] of [["user bubble", ui.userTurns.locator(".assistant-bubble")], ["assistant bubble", ui.assistantTurns.locator(".assistant-bubble")]] as const) {
        const text = await colorOf(chat, bubble, "color");
        expect(contrast(text, await effectiveBackground(bubble)), `${name} text`).toBeGreaterThanOrEqual(4.5);
        expect(await boundary(chat, bubble, log), `${name} boundary`).toBeGreaterThanOrEqual(3);
      }

      // The avatar: its icon against its fill, and its edge against the log it sits in (boundary() measures against the log).
      const avatar = ui.avatars.first();
      expect(contrast(await colorOf(chat, avatar.locator("svg"), "stroke"), await effectiveBackground(avatar)), "avatar icon").toBeGreaterThanOrEqual(3);
      expect(await boundary(chat, avatar, log), "avatar boundary").toBeGreaterThanOrEqual(3);

      // The arrow against the link it sits in.
      const arrow = ui.navLinks.first().locator("svg.lucide-arrow-up-right");
      expect(contrast(await colorOf(chat, arrow, "stroke"), await effectiveBackground(ui.navLinks.first())), "arrow icon").toBeGreaterThanOrEqual(3);

      const result = await audit(chat);
      expect(result.violations, "answer with options").toEqual([]);
    });
  });
}

test.describe("REQ-32: 360 px wrapping", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test("a 500-character message and an 80-character token wrap in both bubbles with no overflow", async ({ chat }) => {
    const token = "z".repeat(80);
    // The whole user message is exactly MAX_MESSAGE: a sentence, a space and the token (Send is disabled above the limit).
    const sentence = "palabra ".repeat(60).slice(0, MAX_MESSAGE - token.length - 1);
    const message = `${sentence} ${token}`;
    expect(message).toHaveLength(MAX_MESSAGE);
    await mockChat(chat, buildAnswer({ lead: [{ text: `${message} ${message}` }], sections: [{ title: "Detalle", items: [[{ text: token }]] }] }));
    await chat.goto("/");
    const ui = await openAssistant(chat);
    await ask(chat, message);
    await expect(ui.assistantTurns).toHaveCount(1);

    const overflow = await chat.evaluate(() => {
      const log = document.querySelector(".assistant-chat-log") as HTMLElement;
      const logBox = log.getBoundingClientRect();
      const bubbles = [...document.querySelectorAll(".assistant-turn .assistant-bubble")] as HTMLElement[];
      return {
        count: bubbles.length,
        content: log.clientWidth - parseFloat(getComputedStyle(log).paddingLeft) - parseFloat(getComputedStyle(log).paddingRight),
        user: (document.querySelector(".assistant-turn.user .assistant-bubble") as HTMLElement).getBoundingClientRect().width,
        log: log.scrollWidth - log.clientWidth,
        page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        // No bubble, and no element inside one, reaches past the log's right edge.
        outside: [...document.querySelectorAll(".assistant-turn *")].filter((node) => node.getBoundingClientRect().right > logBox.right + 0.5).length,
        bubbleScroll: bubbles.map((bubble) => bubble.scrollWidth - bubble.clientWidth)
      };
    });
    expect(overflow.count).toBe(2);
    // REQ-32: the user bubble is at most 80% of the log width; only meaningful with a message this long. Measured against the log's content box (clientWidth minus padding).
    expect(overflow.user).toBeLessThanOrEqual(overflow.content * 0.8 + 0.5);
    expect(overflow.log).toBeLessThanOrEqual(0);
    expect(overflow.page).toBeLessThanOrEqual(0);
    expect(overflow.outside).toBe(0);
    expect(overflow.bubbleScroll.every((value) => value <= 0)).toBe(true);
  });
});

// assistant-data-scope US6 (REQ-33): typing, fades, tap to complete, no replay. Written in T059; first run in Batch E.
test.describe("REQ-33: typing the first lead", () => {
  const FADE_MS = 200;
  const fadeOf = (locator: Locator) =>
    locator.first().evaluate((node) => {
      const list = getComputedStyle(node).transitionDuration.split(",");
      return Math.max(...list.map((part) => parseFloat(part) * (part.trim().endsWith("ms") ? 1 : 1000)));
    });

  test("a long lead is fully shown within 1 s, the layout is final from the first frame, and the buttons wait for it", async ({ chat }) => {
    await mockChat(chat, longLeadAnswer());
    await chat.goto("/");
    const ui = await openAssistant(chat);
    await traceTyping(chat);
    await ask(chat, QUESTION);
    const trace = await waitForTyping(chat);

    expect(trace.end - trace.arrival, "typing duration").toBeLessThanOrEqual(1000);
    const typing = trace.frames.filter((frame) => frame.typing);
    expect(typing.length, "frames while typing").toBeGreaterThan(1);
    // It really types: some frame shows part of the lead, and the count never goes back.
    expect(typing.some((frame) => frame.shown > 0 && frame.shown < LONG_LEAD.length)).toBe(true);
    for (let index = 1; index < typing.length; index++) expect(typing[index].shown).toBeGreaterThanOrEqual(typing[index - 1].shown);
    // Only the first lead types, and what waits for it keeps its space but is neither shown nor focusable.
    expect(Math.max(...trace.frames.map((frame) => frame.overlays))).toBe(1);
    for (const frame of typing) {
      expect(frame.actions, "buttons hidden while typing").toBe("hidden");
      expect(frame.sectionOpacity, "sections wait").toBe("0");
    }
    // The scroll decisions (REQ-11) read the final height: it is the same in every frame, from the first.
    expect(new Set(trace.frames.map((frame) => frame.height)).size, "scrollHeight is final from the first frame").toBe(1);

    await expect(ui.options).toHaveCount(3);
    await expect(ui.options.first()).toBeVisible();
    await expect(ui.assistantTurns.last().locator(".assistant-turn-section")).toHaveCSS("opacity", "1");
    expect(trace.frames.at(-1)?.shown).toBe(LONG_LEAD.length);
  });

  test("a second block and the sources never type; only the first lead does", async ({ chat }) => {
    const answer = longLeadAnswer();
    answer.blocks.push({ title: "Otra cosa", lead: [{ text: "Segundo bloque con su propio texto." }], sections: [], buttons: [] });
    await mockChat(chat, answer);
    await chat.goto("/");
    await openAssistant(chat);
    await traceTyping(chat);
    await ask(chat, QUESTION);
    const trace = await waitForTyping(chat);
    expect(Math.max(...trace.frames.map((frame) => frame.overlays))).toBe(1);
  });

  test("fades are at most 200 ms", async ({ chat }) => {
    await mockChat(chat, longLeadAnswer());
    await chat.goto("/");
    const ui = await openAssistant(chat);
    await ask(chat, QUESTION);
    await expect(ui.assistantTurns).toHaveCount(1);
    const turn = ui.assistantTurns.last();
    for (const [name, locator] of Object.entries({ section: turn.locator(".assistant-turn-section"), sources: turn.locator(".assistant-turn-sources"), buttons: turn.locator(".assistant-actions") })) {
      const ms = await fadeOf(locator);
      expect(ms, `${name} fades`).toBeGreaterThan(0);
      expect(ms, `${name} fade`).toBeLessThanOrEqual(FADE_MS);
    }
  });

  test("tapping the answer completes it at once", async ({ chat }) => {
    await mockChat(chat, longLeadAnswer());
    await chat.goto("/");
    const ui = await openAssistant(chat);
    await traceTyping(chat, { tap: true });
    await ask(chat, QUESTION);
    const trace = await waitForTyping(chat);
    // The tap lands on the first typing frame, so the typing is over a frame or two later, far short of the 900 ms.
    expect(trace.end - trace.arrival).toBeLessThan(300);
    expect(trace.frames.at(-1)?.shown).toBe(LONG_LEAD.length);
    await expect(ui.options).toHaveCount(3);
  });

  test.describe("reduced motion", () => {
    test.use({ reducedMotion: "reduce" });

    test("the whole answer is there at once: no typing, buttons and sections shown, no fade", async ({ chat }) => {
      await mockChat(chat, longLeadAnswer());
      await chat.goto("/");
      const ui = await openAssistant(chat);
      await traceTyping(chat);
      await ask(chat, QUESTION);
      const trace = await waitForTyping(chat);
      expect(trace.frames.filter((frame) => frame.typing), "no typing frame").toHaveLength(0);
      expect(trace.frames[0].shown, "the full lead on the first frame").toBe(LONG_LEAD.length);
      expect(trace.frames[0].actions).toBe("visible");
      expect(trace.frames[0].sectionOpacity).toBe("1");
      expect(await fadeOf(ui.assistantTurns.last().locator(".assistant-turn-section"))).toBe(0);
      await expect(ui.options).toHaveCount(3);
    });
  });

  test("closing and reopening the panel, and navigating, never type a lead again", async ({ chat }) => {
    await mockChat(chat, longLeadAnswer());
    await chat.goto("/");
    const ui = await openAssistant(chat);
    await ask(chat, QUESTION);
    await expect(ui.assistantTurns).toHaveCount(1);
    // From here on, count every typed layer or typing flag that shows up anywhere.
    await chat.evaluate(() => {
      const seen = { count: 0 };
      (window as unknown as { __replays: typeof seen }).__replays = seen;
      new MutationObserver((records) => {
        for (const record of records) {
          const target = record.target as Element;
          if (record.type === "attributes" && target.hasAttribute("data-typing")) seen.count++;
          if (record.type === "childList" && [...record.addedNodes].some((node) => node instanceof Element && (node.matches(".assistant-lead-typed") || node.querySelector(".assistant-lead-typed")))) seen.count++;
        }
      }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-typing"] });
    });

    await ui.close.click();
    await expect(ui.fab).toHaveAttribute("aria-expanded", "false");
    await openAssistant(chat);
    await ui.navLinks.first().click();
    await expect(chat).toHaveURL(new RegExp(`${LINK_HREF}$`));
    await expect(ui.assistantTurns).toHaveCount(1);
    // Longer than the 900 ms a replay would take.
    await chat.waitForTimeout(1200);
    expect(await chat.evaluate(() => (window as unknown as { __replays: { count: number } }).__replays.count), "typing events after the first").toBe(0);
    await expect(ui.typing).toHaveCount(0);
    await expect(ui.navLinks.first()).toHaveText(LINK_LABEL);
  });
});
