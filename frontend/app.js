const API_URL = window.COMPLIMENT_CREATURE_API_URL;

const animalMarks = {
  otter: "🦦",
  frog: "🐸",
  capybara: "🦫",
  crow: "🐦‍⬛",
  axolotl: "🦎",
  moth: "🦋",
};

const form = document.querySelector("#creature-form");
const button = document.querySelector("#generate-button");
const status = document.querySelector("#status");
const result = document.querySelector("#result");
const card = document.querySelector("#creature-card");

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!API_URL || API_URL.includes("your-api-id")) {
    status.textContent = "Add your deployed API URL to frontend/config.js first.";
    return;
  }

  const data = new FormData(form);
  const payload = Object.fromEntries(data.entries());
  button.disabled = true;
  button.textContent = "Calling a creature...";
  status.textContent = "";

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.message || "The creature trail went cold. Please try again.");

    document.querySelector("#animal-mark").textContent = animalMarks[payload.animal] || "✨";
    document.querySelector("#creature-name").textContent = body.name;
    document.querySelector("#compliment").textContent = body.compliment;
    document.querySelector("#trait").textContent = `Known for: ${body.trait}`;
    card.className = `creature-card theme-${body.theme}`;
    result.hidden = false;
    result.scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (error) {
    status.textContent = error.message;
  } finally {
    button.disabled = false;
    button.innerHTML = "Meet my creature <span aria-hidden=\"true\">&#8594;</span>";
  }
});

document.querySelector("#again-button").addEventListener("click", () => {
  result.hidden = true;
  document.querySelector("#animal").focus();
});

document.querySelector("#copy-button").addEventListener("click", async (event) => {
  const text = `${document.querySelector("#creature-name").textContent}\n${document.querySelector("#compliment").textContent}\n${document.querySelector("#trait").textContent}`;
  await navigator.clipboard.writeText(text);
  event.currentTarget.textContent = "Copied";
  window.setTimeout(() => { event.currentTarget.textContent = "Copy words"; }, 1500);
});
