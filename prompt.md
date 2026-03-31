You are evaluating a single static UI screenshot. Conduct a UX Heuristic Evaluation on the provided UI screenshot based on the Primary Evaluation Rubric. Assign scores using the scoring instructions.
Your review must be grounded only in what is directly visible in the image plus the provided context:
- taskDescription: "${taskDescription || 'General usage'}"
- userType: "${personaDescription || 'General public'}"

PRIMARY EVALUATION RUBRIC:
Evaluate the UI across these 12 detailed dimensions:

1. Purpose and task clarity
- Is the purpose clear from visible elements (title, heading, content)?
- Is the primary task obvious?
- Does it support a single main goal or are there competing purposes?
- Any elements creating ambiguity?

2. Information hierarchy and layout
- Clear visual entry point?
- Is important info prioritized over secondary content?
- Are related elements logically grouped and spaced?
- Clean alignment and scanability?
- Cluttered, dense, or visually overwhelming?

3. Consistency and visible conventions
- Similar elements styled consistently?
- Consistent labels, icons, components, and interaction patterns?
- Follows common UI conventions?

4. Recognition and learnability
- Icons and visuals understandable without explanation?
- Controls self-explanatory?
- Inferred actions clear from labels?
- Clear for first-time users?

5. Primary action clarity and affordance
- Primary action identifiable?
- Single dominant CTA or competing actions?
- Secondary actions distinct?
- Interactive elements look clickable/tappable?
- Buttons/inputs distinguishable from static elements?

6. Readability and content clarity
- Legible font size/weight?
- Text density appropriate?
- Clear, concise, and unambiguous wording?
- Clear text hierarchy?

7. Contrast and perceptual accessibility signals
- Sufficient text/background contrast?
- Important elements distinguishable?
- Colors guide attention effectively?
- Visibility issues?

8. User control and efficiency cues (when visible)
- Visible back/cancel/exit options?
- Controls for editing/undoing?
- Navigation and shortcuts available?

9. Error prevention and form safety (when visible)
- Required/optional fields indicated?
- Inputs constrained (dropdowns, formats)?
- Destructive actions highlighted/separated?
- Cues to prevent errors before submission?

10. System status and feedback cues (when visible)
- Indication of current state (selected, progress, steps)?
- Visible feedback signals (confirmations, status)?
- Loading/processing indicated?

11. Trust and risk communication cues
- Visible trust signals (branding, security)?
- Costs, commitments, or consequences communicated?
- Any elements creating doubt or hesitation?

12. Audience and context fit
- Language appropriate for intended user?
- Terms/concepts aligned with audience?
- Matches needs and expectations for this task/platform?

SCORING INSTRUCTIONS:
Provide three RAW scores:
- aesthetics_raw (1-10): Based on layout, color, and visual complexity (Rubric points 2, 7).
  1: Clashing colors, illegible contrast, or overlapping elements.
  5: Clean and usable, but basic. Lacks branding or custom polish.
  10: Perfect alignment, cohesive branding, and intentional whitespace.
- learnability_raw (1-5): How easy is it to figure out the task? (Rubric points 1, 4).
  1: User cannot identify the goal or task without a manual.
  3: Uses familiar icons and layouts. User needs a few seconds to orient.
  5: The task is self-evident. A first-time user knows exactly what to do.
- efficiency_raw (1-5): How well does the UI signal pathways/components? (Rubric points 5, 8).
  1: Actions are hidden or confusing. Hard to tell what is clickable.
  3: Standard navigation. User can find the path.
  5: High-affordance buttons dominate the view. Zero friction.

CRITIQUE FORMAT (Sadler Method):
Each critique must follow the Sadler Method: 1. standard, 2. gap, 3. recommendedFix.
Include: id, targetLocation, evaluationDimension, reportingTag (layout, contrast, readability, buttons, learnability, other), and severity (high, medium, low).

Do not output markdown. Be precise, direct, and professional.