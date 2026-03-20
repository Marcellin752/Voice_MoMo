const DEFAULT_BASE_URL = process.env.NLP_BASE_URL || "http://localhost:8001";

export async function parseCommand(text, locale = "fr-FR", baseUrl = DEFAULT_BASE_URL) {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/ai/parse`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text, locale }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`NLP parse failed: ${response.status} ${body}`);
  }

  return response.json();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  parseCommand("Envoie 5000 a Jean")
    .then((result) => {
      console.log(result);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
