// After wave 11 of the Fortis Colosseum Minimus offers a modifier once more, and the choice leads into Sol Heredit's
// fight with the modifiers of the run that his fight has.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const origin = process.env.TEST_ORIGIN;
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--enable-unsafe-swiftshader"],
});

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
  // A probe: the engine of each fight, by its kind.
  await page.route("**/engine/SimulationEngine.js*", async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    const marker = "this.encounter = options.encounter;";
    assert.ok(body.includes(marker));
    await route.fulfill({ response, body: body.replace(marker, marker + "(window.engines ??= {})[options.encounter.kind] = this;") });
  });

  await page.goto(origin + "/colosseum/");
  await page.waitForFunction(() => window.engines?.colosseum, null, { timeout: 60000 });
  await page.locator(".loading-screen").waitFor({ state: "hidden", timeout: 60000 });

  // Ticked from here. The run is put on wave 11 before the first choice; its monsters are taken out of the world the
  // tick after they are placed, as if the last of them had just been removed.
  const offer = await page.evaluate(() => {
    const engine = engines.colosseum;
    const encounter = engine.encounter;
    const tick = () => engine.advanceTick(engine.player().position);
    const state = () => engine.getEncounterSnapshot().state;
    const command = (type, more) => engine.queueEncounterCommand({ encounter: "colosseum", type, ...more });
    engine.setMechanicsConfig({ ...engine.mechanicsConfig, infiniteHealth: true });
    while (!engine.worldState.getNpc("colosseum_minimus")) tick();
    command("talk-to-minimus");
    tick();
    encounter.wave = 11;
    command("choose-modifier", { choice: 0 });
    tick();
    while (state().phase !== "active") tick();
    const lastId = [...encounter.undefeated].at(-1);
    for (const npcId of encounter.undefeated) engine.despawnNpc(npcId);
    encounter.undefeated.clear();
    encounter.phase = "cleared";
    encounter.reinforcementTick = null;
    encounter.lastDefeat = { npcId: lastId, tick: engine.currentTick, encounterOwned: true };
    while (!state().offer) tick();
    const offered = { wave: state().wave, phase: state().phase, title: state().offer.title, options: state().offer.options.length, outcome: engine.getEncounterOutcome().phase };
    encounter.modifiers = { ...encounter.modifiers, mantimayhem: 1 };
    command("choose-modifier", { choice: 0 });
    tick();
    return { ...offered, next: engine.getEncounterOutcome().next, modifiers: encounter.modifiers };
  });
  assert.deepEqual({ ...offer, next: undefined, modifiers: undefined }, { wave: 12, phase: "intermission", title: "Wave 11 Completed!", options: 3, outcome: "active", next: undefined, modifiers: undefined });
  assert.equal(offer.next.encounterKind, "sol_heredit");
  // Mantimayhem is of the waves only: Sol Heredit's fight is not handed it.
  assert.equal(offer.modifiers.mantimayhem, 1);
  assert.equal(offer.next.modifiers.mantimayhem, undefined);
  assert.ok(Object.keys(offer.next.modifiers).length >= 1);

  // The application enters Sol Heredit's fight with those modifiers.
  await page.waitForFunction(() => window.engines.sol_heredit, null, { timeout: 60000 });
  assert.deepEqual(await page.evaluate(() => ({ ...engines.sol_heredit.encounter.modifiers })), offer.next.modifiers);
  await page.locator(".loading-screen").waitFor({ state: "hidden", timeout: 60000 });
} finally {
  await browser.close();
}
