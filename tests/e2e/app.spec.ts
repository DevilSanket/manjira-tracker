import { test, expect } from "@playwright/test";
test("studio navigation, mobile layout and keyboard controls", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Let’s play Manjira!" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Calibrate input" })).toHaveCount(0);
  await page.getByLabel("Play with a beat").check();
  await page.getByRole("button", { name: "Slow", exact: true }).click();
  await expect(page.getByRole("button", { name: "Slow", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Play with a beat").uncheck();
  await page.getByRole("button", { name: "Lessons", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /^start lesson$/i }),
  ).toBeVisible({ timeout: 20000 });
  await page
    .getByRole("button", { name: "Rhythm practice", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /^start training$/i }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Progress", exact: true }).click();
  await expect(page.getByText("Your first session starts here")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});
test("microphone starts, stops and recovers from permission denial", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    (window as any).originalGetUserMedia =
      navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = () =>
      Promise.reject(new DOMException("Denied", "NotAllowedError"));
  });
  await page
    .getByRole("button", { name: "Start playing", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Allow microphone access",
  );
  await expect(
    page.getByRole("button", { name: "Start playing", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    navigator.mediaDevices.getUserMedia = (window as any).originalGetUserMedia;
  });
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByText("Listening", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Finish", exact: true })
    .click();
  await expect(
    page.getByText("Ready when you are", { exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Start playing", exact: true })
    .click();
  await expect(page.getByText("Listening", { exact: true })).toBeVisible();
});
test("calibration measures after access and restores focus on Escape", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Teacher / Parent settings" }).click();
  await page.getByRole("button", { name: "Calibrate input" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("button", { name: "Start calibration", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Begin capture", exact: true })
    .click();
  await expect(page.getByText("7s", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Cancel capture", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Calibrate input" }),
  ).toBeFocused();
});
test("serial input never requests a microphone and stops inactive events", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    (window as any).microphoneRequests = 0;
    navigator.mediaDevices.getUserMedia = async () => {
      (window as any).microphoneRequests++;
      throw new Error("Should not start");
    };
  });
  await page.getByRole("button", { name: "Teacher / Parent settings" }).click();
  await page.getByRole("button", { name: "USB serial", exact: true }).click();
  await page
    .getByRole("button", { name: "Start playing", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Connect your USB serial device",
  );
  expect(await page.evaluate(() => (window as any).microphoneRequests)).toBe(0);
});
test("lesson result and calibration preferences survive reload; export works", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem(
      "manjira-settings",
      JSON.stringify({
        version: 1,
        state: {
          calibration: {
            noiseFloor: 0.01,
            openZcr: 0.28,
            closedZcr: 0.15,
            minStrikePeak: 0.015,
            maxStrikePeak: 0.95,
            openSamples: [],
            closedSamples: [],
            inputLatency: 35,
          },
          completedLessonIds: ["lesson_1"],
          sessions: [
            {
              id: "fixture",
              date: "2026-10-12T06:00:00Z",
              title: "Tardi Strike",
              bpm: 80,
              accuracy: 80,
              stats: {
                correctType: 8,
                incorrectType: 2,
                perfect: 0,
                near: 0,
                miss: 0,
              },
            },
          ],
        },
      }),
    );
  });
  await page.reload();
  await page.getByRole("button", { name: "Teacher / Parent settings" }).click();
  await expect(page.getByText(/Delay compensation 35 ms/)).toBeVisible();
  await page.getByRole("button", { name: "Progress", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "80%", exact: true }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export history", exact: true })
    .click();
  expect((await download).suggestedFilename()).toBe(
    "manjira-practice-history.json",
  );
});
test("cancelled startup stops a late microphone stream", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    const ctx = new AudioContext();
    const stream = ctx.createMediaStreamDestination().stream;
    (window as any).lateStream = stream;
    navigator.mediaDevices.getUserMedia = () =>
      new Promise((resolve) => {
        (window as any).releaseMicrophone = () => resolve(stream);
      });
  });
  await page
    .getByRole("button", { name: "Start playing", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => typeof (window as any).releaseMicrophone))
    .toBe("function");
  await page
    .getByRole("button", { name: "Cancel startup", exact: true })
    .click();
  await page.evaluate(() => (window as any).releaseMicrophone());
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).lateStream.getTracks()[0].readyState),
    )
    .toBe("ended");
  await expect(
    page.getByRole("button", { name: "Start playing", exact: true }),
  ).toBeVisible();
});
test("serial telemetry is ignored while idle and accepted only while listening", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    const readable = new ReadableStream({
      start(controller) {
        (window as any).serialController = controller;
      },
    });
    Object.defineProperty(navigator, "serial", {
      configurable: true,
      value: {
        requestPort: async () => ({
          readable,
          open: async () => {},
          close: async () => {},
          getInfo: () => ({ usbVendorId: 0x451 }),
        }),
      },
    });
    (window as any).sendTelemetry = (line: string) =>
      (window as any).serialController.enqueue(
        new TextEncoder().encode(line + "\n"),
      );
  });
  await page.getByRole("button", { name: "Teacher / Parent settings" }).click();
  await page.getByRole("button", { name: "USB serial", exact: true }).click();
  await page.getByRole("button", { name: "Connect USB", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Disconnect USB", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => (window as any).sendTelemetry("OPEN,92,3450"));
  await expect(
    page.getByRole("heading", { name: "Your turn to play", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Start playing", exact: true })
    .click();
  await expect(page.getByText("Listening", { exact: true })).toBeVisible();
  // Connection and start interactions leave enough time for the transient cooldown.
  await expect
    .poll(async () => {
      await page.evaluate(() =>
        (window as any).sendTelemetry("CLOSED,90,1800"),
      );
      return await page
        .getByRole("heading", { name: "Tardi!", exact: true })
        .count();
    })
    .toBe(1);
  await page
    .getByRole("button", { name: "Finish", exact: true })
    .click();
  await page.evaluate(() => (window as any).sendTelemetry("OPEN,92,3450"));
  await expect(page.getByRole("status")).toContainText("Your practice is saved");
  await expect(page.getByRole("heading", { name: "Your turn to play", exact: true })).toBeVisible();
  const sessions = await page.evaluate(() => JSON.parse(localStorage.getItem("manjira-settings")!).state.sessions);
  expect(sessions[0].strikes).toBeGreaterThan(0);
  await page
    .getByRole("button", { name: "Disconnect USB", exact: true })
    .click();
  await expect(page.getByText("No USB serial device connected")).toBeVisible();
});
test("complete calibration captures real synthetic audio and persists all classifier features", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/");
  await page.evaluate(() => {
    const ctx = new AudioContext();
    const destination = ctx.createMediaStreamDestination();
    navigator.mediaDevices.getUserMedia = async () => destination.stream;
    (window as any).playFixture = async (decay: number) => {
      await ctx.resume();
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        const t = i / ctx.sampleRate;
        data[i] =
          0.75 *
          Math.exp(-decay * t) *
          (Math.sin(2 * Math.PI * 3500 * t) +
            0.15 * Math.sin(2 * Math.PI * 5200 * t));
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(destination);
      source.start();
    };
  });
  await page.getByRole("button", { name: "Teacher / Parent settings" }).click();
  await page.getByRole("button", { name: "Calibrate input" }).click();
  await page
    .getByRole("button", { name: "Start calibration", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Begin capture", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Let the edges ring freely",
      exact: true,
    }),
  ).toBeVisible({ timeout: 15000 });
  for (const [decay, nextHeading] of [
    [12, "Hold the rim to damp the ring"],
    [120, "Adjust only if your hits feel late"],
  ] as const) {
    // Each calibration owns a fresh stream, matching the microphone's real lifecycle.
    await page.evaluate(() => {
      const ctx = new AudioContext();
      const destination = ctx.createMediaStreamDestination();
      navigator.mediaDevices.getUserMedia = async () => destination.stream;
      (window as any).playFixture = async (decay: number) => {
        await ctx.resume();
        const buffer = ctx.createBuffer(
          1,
          ctx.sampleRate * 0.3,
          ctx.sampleRate,
        );
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
          const t = i / ctx.sampleRate;
          data[i] =
            0.75 * Math.exp(-decay * t) * Math.sin(2 * Math.PI * 3500 * t);
        }
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(destination);
        source.start();
      };
    });
    await page
      .getByRole("button", { name: "Begin capture", exact: true })
      .click();
    for (let count = 0; count < 5; count++) {
      await expect
        .poll(
          async () => {
            await page.evaluate(
              (decay) => (window as any).playFixture(decay),
              decay,
            );
            return (
              (await page
                .getByLabel(`${count + 1} of 5 strikes captured`, {
                  exact: true,
                })
                .count()) +
              (await page
                .getByRole("heading", { name: nextHeading, exact: true })
                .count())
            );
          },
          { timeout: 10000, intervals: [400] },
        )
        .toBeGreaterThan(0);
    }
    await expect(
      page.getByRole("heading", { name: nextHeading, exact: true }),
    ).toBeVisible();
  }
  await page.getByLabel("Delay compensation").fill("35");
  await page
    .getByRole("button", { name: "Save calibration", exact: true })
    .click();
  await expect(page.getByText("Your calibration is saved")).toBeVisible();
  const stored = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("manjira-settings")!).state.calibration,
  );
  expect(stored.openSamples).toHaveLength(5);
  expect(stored.closedSamples).toHaveLength(5);
  expect(stored.openSamples[0].peakProminence).toBeGreaterThan(0);
  expect(stored.openSamples[0].decayRatio).toBeGreaterThan(
    stored.closedSamples[0].decayRatio,
  );
  await page.reload();
  await page.getByRole("button", { name: "Teacher / Parent settings" }).click();
  await expect(page.getByText("Your calibration is saved")).toBeVisible();
});
test("restored rhythm arena counts silent notes and saves results", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Rhythm practice", exact: true })
    .click();
  await page.getByRole("button", { name: /^start training$/i }).click();
  await expect(
    page.getByRole("heading", { name: /विठ्ठल RHYTHM/ }),
  ).toBeVisible();
  await expect(page.getByText("BEATS LEFT", { exact: false })).toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate(() => {
        // Silent input must resolve expected notes as misses rather than scoring nothing.
        return document.querySelectorAll('img[alt="Vitthal Mauli"]').length;
      }),
    )
    .toBeGreaterThan(0);
  await expect
    .poll(
      async () => {
        const text = await page.getByText(/\d+ BEATS LEFT/).innerText();
        return Number(text.match(/\d+/)?.[0]);
      },
      { timeout: 20000 },
    )
    .toBeLessThan(56);
  await page.getByRole("button", { name: /^finish$/i }).click();
  await expect(
    page.getByRole("heading", { name: /rhythm practice complete/i }),
  ).toBeVisible();
  const saved = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("manjira-settings")!).state.sessions[0],
  );
  expect(saved.stats.incorrectType).toBeGreaterThan(0);
  expect(saved.title).toContain("rhythm practice");
});

for (const mode of ["Lessons", "Rhythm practice"]) {
  test(`${mode} restores the original fullscreen UI and exit controls`, async ({
    page,
  }) => {
    await page.goto("/");
    await page.evaluate(() => {
      HTMLElement.prototype.requestFullscreen = () =>
        Promise.reject(new Error("Unavailable"));
    });
    await page.getByRole("button", { name: mode, exact: true }).click();
    if (mode === "Lessons") {
      await expect(
        page.getByRole("heading", { name: /Journey to Mastery/i }),
      ).toBeVisible();
      await page.getByRole("button", { name: /^start lesson$/i }).click();
      await expect(
        page.getByRole("button", { name: /ready to play/i }),
      ).toBeVisible();
    } else {
      await page.getByRole("button", { name: /^start training$/i }).click();
      await expect(
        page.getByRole("heading", { name: /विठ्ठल RHYTHM/ }),
      ).toBeVisible();
    }
    await expect(page.getByTitle("Exit Fullscreen")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTitle("Enter Fullscreen")).toBeVisible();
    await page.getByTitle("Enter Fullscreen").click();
    await expect(page.getByTitle("Exit Fullscreen")).toBeVisible();
    await page.getByTitle("Exit Fullscreen").click();
    await expect(page.getByTitle("Enter Fullscreen")).toBeVisible();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
  });
}

test("lesson journey begins with Tardi and uses the updated grip instruction", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Lessons", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Tardi Strike", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Grip the metal rims firmly/)).toBeVisible();
  await page.getByRole("button", { name: /^start lesson$/i }).click();
  await expect(
    page.getByRole("heading", { name: /Learning the Tardi Strike/i }),
  ).toBeVisible();
  await page.getByRole("button", { name: /ready to play/i }).click();
  await expect(page.getByText("Tardi", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: /^finish$/i }).click();
  await page.getByRole("button", { name: /^next step$/i }).click();
  await expect(
    page.getByRole("heading", { name: "Murda Strike", exact: true }),
  ).toBeVisible();
});
