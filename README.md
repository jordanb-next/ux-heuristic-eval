# UX Heuristic Eval App

## Overview
The AI-Powered UX Heuristic Eval App is an expert-level UI design reviewer tool. It performs automated audits of static UI screenshots by evaluating them against a rigorous 12-point heuristic rubric. The app provides quantitative scoring, qualitative critiques using the Sadler Method, and precise visual localization of identified issues.

## Key Features
* Screenshot Analysis: Upload any UI screenshot (PNG/JPG) for immediate expert evaluation.
* Contextual Awareness: Tailor the audit by providing specific task descriptions and user personas, such as Insurance Agents or various Small Business Owner segments.
* Visual Issue Localization: Automatically maps identified UI flaws to specific bounding box coordinates on the uploaded image.
* Interactive Report: A dashboard displaying detailed scores, executive summaries, and a highlighted audit list.
* PDF Export: Generate a portable document of the audit findings for sharing with design and development teams.

## The Evaluation System

### 12-Point Heuristic Rubric
The engine evaluates the interface across twelve distinct dimensions:
1. Purpose and task clarity
2. Information hierarchy and layout
3. Consistency and visible conventions
4. Recognition and learnability
5. Primary action clarity and affordance
6. Readability and content clarity
7. Contrast and perceptual accessibility signals
8. User control and efficiency cues
9. Error prevention and form safety
10. System status and feedback cues
11. Trust and risk communication cues
12. Audience and context fit

### Scoring Methodology
The app generates three primary metrics to quantify design quality:
* Aesthetics (1-10): Calculated based on layout, color usage, and visual complexity.
* Usability (1-10): Derived from the combined total of Learnability (1-5) and Efficiency (1-5).
* Overall Design Quality (1-10): The average of the Aesthetics and Usability scores.

### The Sadler Method for Critiques
Every audit finding follows the Sadler Method to ensure actionable feedback:
1. Standard: The established UI principle or design pattern that should be met.
2. Gap: The specific failure or deficiency observed in the current screenshot.
3. Recommended Fix: A professional recommendation on how to bridge the gap and meet the standard.

## Technical Architecture
The application is built with a modern web stack:
* Frontend: React 19 and TypeScript.
* Styling: Tailwind CSS 4.
* AI Engine: Powered by the Gemini 3 Flash Vision model via the Google Generative AI SDK.
* Utilities: Lucide React for iconography, Framer Motion for animations, and html2canvas/jsPDF for report generation.
* Uses Gemini 2.5 Flash 

## Getting Started

### Prerequisites
* Node.js installed on your machine.
* A Gemini API Key from Google AI Studio.

### Installation
1. Install project dependencies:
   npm install

2. Configuration:
   Create a .env.local file (or use .env.example as a template) and set your GEMINI_API_KEY.

3. Development Mode:
   Run the app locally:
   npm run dev
   The application will be available at http://localhost:3000.

### Build and Deployment
* To create a production build:
  npm run build
* To preview the production build:
  npm run preview