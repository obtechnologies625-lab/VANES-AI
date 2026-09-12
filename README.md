# VANES AI

VANES AI is a browser-based study companion for learners following the Tanzanian secondary-school curriculum. It includes a personal learner profile, subject library, study planner, notes, online OpenRouter AI assistance, and image-based question analysis.

## Run locally

No build step or npm dependencies are required.

```bash
py -m http.server 4173
```

Then open `http://localhost:4173` in a browser.

## Configure the online AI

Open `app.js` and edit these two values near the top:

```js
const OPENROUTER_API_KEY = "YOUR_OPENROUTER_API_KEY_HERE";
const OPENROUTER_MODEL = "openai/gpt-4o-mini";
```

Replace the placeholder with your OpenRouter API key and keep the model as-is unless you want to use another OpenRouter-supported model. An internet connection is required for online AI responses.

> **Security:** This version calls OpenRouter directly from the browser because it is designed for easy local testing. A browser-exposed API key can be copied by users. For a public/production deployment, move the OpenRouter request to a server-side endpoint and store the key as a server secret.

## How to use the AI

1. Open **AI study coach**.
2. Type a normal question, in English or Kiswahili.
3. Use tags to control the kind of help you want:
   - `#explain` — teach a concept clearly from first principles.
   - `#practice` — create practice questions and marking guidance.
   - `#analyze` — deeply inspect an answer, identify mistakes, and explain corrections.
   - `#plan` — create a realistic study plan.
   - `#summarize` — make structured revision notes.
   - `#translate` — translate while preserving meaning.
   - `#mark` — assess an answer using a transparent rubric.

### Examples

```text
#explain Form 4 Chemistry: acids and bases
#practice Form 2 Geography: weather and climate
#analyze I got 3/5 for this question. Explain my mistakes.
#plan I have 14 days to prepare for my Physics exam.
#summarize the causes of the Maji Maji Rebellion
#translate Explain this paragraph in Kiswahili
#mark Here is my History answer: ...
```

## Image analysis

Use the **image button** beside the chat box to upload a photo of a textbook page, handwritten answer, diagram, or exam question. Add an instruction such as:

```text
#analyze Solve this question step by step and explain where my method went wrong.
```

The image is sent to the configured OpenRouter vision-capable model for analysis.

## Personal account

The first time the app opens, it asks for the learner's name and creates a local profile. The name and progress/preferences are stored in the browser's `localStorage`. This is a local profile, not a cloud account or authentication system.

## Subjects

The subject library includes a broad set of common Tanzanian O-Level/CSEE and A-Level/ACSEE subjects, including Kiswahili, English Language, Basic Mathematics, Basic Applied Mathematics, Advanced Mathematics, History, Geography, Chemistry, Physics, Biology, Civics, Information and Computer Studies, Commerce, Bookkeeping, Agriculture, Food and Nutrition, Fine Art, Music, French, Arabic, Bible Knowledge, Islamic Knowledge, Physical Education, Economics, General Studies, Computer Science, and Accountancy. Schools may offer different subject combinations.
