import React, { useState, useRef } from 'react';
import { 
  Upload, 
  Image as ImageIcon, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Download, 
  Layout, 
  Zap,
  Info,
  Target,
  Search,
  Maximize2
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// --- Helper Functions ---

const calculateMetrics = (rawScores: any) => {
  // 1. Aesthetics (1-10) is taken directly from AI evaluation
  const aesthetics = rawScores.aesthetics_raw; 

  // 2. Sub-dimensions (1-5 scale)
  const learnability = rawScores.learnability_raw;
  const efficiency = rawScores.efficiency_raw;

  // 3. Usability (10-point scale) 
  // Math: Learnability (5) + Efficiency (5) = 10
  const usability = learnability + efficiency; 

  // 4. Overall Design Quality (10-point scale)
  // Math: Average of Aesthetics and Usability
  const overall = parseFloat(((aesthetics + usability) / 2).toFixed(1));

  return {
    aesthetics,
    learnability,
    efficiency,
    usability,
    overall
  };
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = error => reject(error);
  });
};

const drawCoordinateAxis = async (imageFile: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject('No context');

      ctx.drawImage(img, 0, 0);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fillRect(0, 0, canvas.width, 30);
      ctx.fillRect(0, canvas.height - 30, canvas.width, 30);
      ctx.fillRect(0, 0, 45, canvas.height);
      ctx.fillRect(canvas.width - 45, 0, 45, canvas.height);

      ctx.fillStyle = 'black';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (let i = 1; i < 10; i++) {
        const x = (i / 10) * img.width;
        const val = i * 100;
        ctx.fillText(val.toString(), x, 15);
        ctx.fillText(val.toString(), x, canvas.height - 15);
      }

      for (let i = 1; i < 10; i++) {
        const y = (i / 10) * img.height;
        const val = i * 100;
        ctx.fillText(val.toString(), 22, y);
        ctx.fillText(val.toString(), canvas.width - 22, y);
      }

      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      resolve(dataUrl.split(',')[1]);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(imageFile);
  });
};

// --- Sub-Components ---

const SeverityBadge = ({ severity }: { severity: string }) => {
  const styles: Record<string, string> = {
    high: "bg-red-100 text-red-700 border-red-200",
    medium: "bg-orange-100 text-orange-700 border-orange-200",
    low: "bg-amber-100 text-amber-700 border-amber-200"
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${styles[severity] || styles.low}`}>
      {severity}
    </span>
  );
};

const ScoreBar = ({ val, max, label, icon: Icon, colorClass }: { val: number, max: number, label: string, icon: any, colorClass: string }) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between">
      <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest flex items-center gap-1">
        {Icon && <Icon className="w-3 h-3" />} {label}
      </p>
      <span className="text-xs font-bold text-neutral-600">{val}/{max}</span>
    </div>
    <div className="flex gap-0.5 h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden">
      {Array.from({ length: max }).map((_, i) => (
        <div 
          key={i} 
          className={`flex-1 h-full rounded-full transition-all duration-1000 ${i < val ? colorClass : 'bg-transparent'}`} 
          style={{ transitionDelay: `${i * 100}ms` }}
        />
      ))}
    </div>
  </div>
);

// --- Main App ---

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [taskDescription, setTaskDescription] = useState('');
  const [userRole, setUserRole] = useState('');
  const [smbSegment, setSmbSegment] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
      setResults(null);
      setError(null);
    }
  };

  const runEvaluation = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError(null);
    setResults(null);

    try {
      setLoadingStep('Phase 1: Generating Critiques & Scoring...');
      const base64Data = await fileToBase64(file);
      
      let personaDescription = '';
      if (userRole === 'agent') {
        personaDescription = "Insurance agent or broker who manages multiple client policies, values efficiency, quick access to information, and clear workflows.";
      } else if (userRole === 'smb_owner') {
        const segments: Record<string, string> = {
          retail: "Retail store owner who needs to manage inventory, sales, and customer interactions quickly.",
          food_bev: "Restaurant or cafe owner operating in a fast-paced environment. Values high visibility and mobile-friendly designs.",
          professional_services: "Consultant or professional service provider who deals with complex documents and billing. Values data accuracy.",
          contractors: "Contractor on the go. Needs to manage quotes from mobile devices. Values large touch targets."
        };
        personaDescription = segments[smbSegment] || "Small business owner.";
      }

      const reviewerPrompt = `
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
`;

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          scores: {
            type: Type.OBJECT,
            properties: {
              aesthetics_raw: { type: Type.NUMBER, description: "1-10 score based on layout, color, and complexity" },
              learnability_raw: { type: Type.NUMBER, description: "1-5 score: Ease of figuring out the task" },
              efficiency_raw: { type: Type.NUMBER, description: "1-5 score: Understanding of components/pathways" }
            },
            required: ['aesthetics_raw', 'learnability_raw', 'efficiency_raw']
          },
          aestheticsRationale: { type: Type.STRING },
          learnabilityRationale: { type: Type.STRING },
          efficiencyRationale: { type: Type.STRING },
          overallRationale: { type: Type.STRING },
          critiques: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                standard: { type: Type.STRING },
                gap: { type: Type.STRING },
                recommendedFix: { type: Type.STRING },
                targetLocation: { type: Type.STRING },
                evaluationDimension: { type: Type.STRING },
                reportingTag: { type: Type.STRING, description: "One of: layout, contrast, readability, buttons, learnability, other" },
                severity: { type: Type.STRING, description: "One of: high, medium, low" }
              },
              required: ['id', 'standard', 'gap', 'recommendedFix', 'targetLocation', 'evaluationDimension', 'reportingTag', 'severity']
            }
          }
        },
        required: ['scores', 'critiques', 'aestheticsRationale', 'overallRationale', 'learnabilityRationale', 'efficiencyRationale']
      };

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      const reviewerResult = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            { text: reviewerPrompt },
            { inlineData: { mimeType: file.type, data: base64Data } }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: responseSchema
        }
      });

      const reviewDataText = reviewerResult.text;
      if (!reviewDataText) throw new Error("No text returned from Gemini");
      const reviewData = JSON.parse(reviewDataText);

      setLoadingStep('Phase 2: Localizing Issues...');
      const axisBase64 = await drawCoordinateAxis(file);

      const localizerPrompt = `
Based on these critiques, provide the [ymin, xmin, ymax, xmax] bounding box coordinates (0-1000 scale).
Critiques to localize:
${JSON.stringify(reviewData.critiques.map((c: any) => ({ id: c.id, gap: c.gap, location: c.targetLocation })))}
`;

      const localizerResult = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            { text: localizerPrompt },
            { inlineData: { mimeType: "image/jpeg", data: axisBase64 } }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                box: { type: Type.ARRAY, items: { type: Type.NUMBER } }
              },
              required: ["id", "box"]
            }
          }
        }
      });

      const localizationDataText = localizerResult.text;
      if (!localizationDataText) throw new Error("No text returned from Gemini for localization");
      const localizationData = JSON.parse(localizationDataText);

      // --- Apply the Scoring Logic ---
      const scores = calculateMetrics(reviewData.scores);

      const finalizedResults = {
        scores: {
          aesthetics: { val: scores.aesthetics, rationale: reviewData.aestheticsRationale },
          usability: { 
            val: scores.usability, 
            rationale: `Usability is derived from the sum of Learnability (${scores.learnability}/5) and Efficiency (${scores.efficiency}/5).` 
          },
          overall: { val: scores.overall, rationale: reviewData.overallRationale },
          learnability: { val: scores.learnability, rationale: reviewData.learnabilityRationale },
          efficiency: { val: scores.efficiency, rationale: reviewData.efficiencyRationale }
        },
        critiques: reviewData.critiques.map((c: any) => ({
          ...c,
          box: localizationData.find((l: any) => l.id === c.id)?.box
        }))
      };

      setResults(finalizedResults);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Evaluation failed.');
    } finally {
      setIsProcessing(false);
      setLoadingStep('');
    }
  };

  const handleExportPDF = () => {
    setIsExporting(true);
    setTimeout(async () => {
      if (!reportRef.current) {
        setIsExporting(false);
        return;
      }
      try {
        const canvas = await html2canvas(reportRef.current, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#F8F9FA'
        });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
          orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
          unit: 'px',
          format: [canvas.width, canvas.height]
        });
        pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
        pdf.save('UX-Heuristic-Report.pdf');
      } catch (err) {
        console.error("PDF Export failed", err);
      } finally {
        setIsExporting(false);
      }
    }, 300);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-neutral-900 font-sans selection:bg-blue-100">
      {/* Header */}
      <nav className="border-b bg-[rgba(255,255,255,0.8)] backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-neutral-900 rounded-xl flex items-center justify-center">
              <Target className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-base leading-none tracking-tight">UI Evaluator</span>
              <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider mt-1">UX Audit v2.5</span>
            </div>
          </div>
          {results && (
            <div className="flex items-center gap-2">
              <button 
                onClick={handleExportPDF}
                disabled={isExporting}
                className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl text-xs font-bold transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {isExporting ? 'Exporting...' : 'Export PDF'}
              </button>
              <button 
                onClick={() => { setResults(null); setFile(null); setPreviewUrl(null); }}
                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 rounded-xl text-xs font-bold transition-all text-neutral-600"
              >
                Start New Evaluation
              </button>
            </div>
          )}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {!results && !isProcessing && (
          <div className="max-w-xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-3">
              <h1 className="text-4xl font-extrabold tracking-tight text-neutral-900">Expert UI Insights</h1>
              <p className="text-neutral-500 text-lg">Expanded 12-point heuristic rubric.</p>
            </div>

            <div className="bg-white rounded-[32px] shadow-2xl shadow-neutral-200 border border-neutral-200 overflow-hidden">
              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-neutral-400 ml-1">The Goal</label>
                  <input
                    type="text"
                    value={taskDescription}
                    onChange={(e) => setTaskDescription(e.target.value)}
                    placeholder="e.g., User needs to submit a quote request"
                    className="w-full px-5 py-4 rounded-2xl border border-neutral-200 focus:ring-4 focus:ring-[rgba(59,130,246,0.1)] focus:border-blue-500 outline-none transition-all placeholder:text-neutral-300 font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-neutral-400 ml-1">Persona</label>
                    <select
                      value={userRole}
                      onChange={(e) => setUserRole(e.target.value)}
                      className="w-full px-5 py-4 rounded-2xl border border-neutral-200 focus:ring-4 focus:ring-[rgba(59,130,246,0.1)] focus:border-blue-500 outline-none appearance-none bg-white transition-all cursor-pointer font-medium"
                    >
                      <option value="">General User</option>
                      <option value="agent">Insurance Agent</option>
                      <option value="smb_owner">Small Business Owner</option>
                    </select>
                  </div>
                  {userRole === 'smb_owner' && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-left-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-neutral-400 ml-1">Industry</label>
                      <select
                        value={smbSegment}
                        onChange={(e) => setSmbSegment(e.target.value)}
                        className="w-full px-5 py-4 rounded-2xl border border-neutral-200 focus:ring-4 focus:ring-[rgba(59,130,246,0.1)] focus:border-blue-500 outline-none appearance-none bg-white transition-all cursor-pointer font-medium"
                      >
                        <option value="retail">Retail</option>
                        <option value="food_bev">Food & Bev</option>
                        <option value="professional_services">Professional Services</option>
                        <option value="contractors">Contractors</option>
                      </select>
                    </div>
                  )}
                </div>

                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className={`group relative border-2 border-dashed rounded-[24px] p-10 text-center cursor-pointer transition-all duration-300 ${previewUrl ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50'}`}
                >
                  <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" />
                  {previewUrl ? (
                    <div className="space-y-4">
                      <div className="relative inline-block">
                        <img src={previewUrl} alt="Preview" className="max-h-48 rounded-xl shadow-lg ring-1 ring-neutral-200" />
                        <div className="absolute inset-0 bg-transparent group-hover:bg-[rgba(0,0,0,0.2)] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all rounded-xl">
                          <ImageIcon className="w-8 h-8 text-white" />
                        </div>
                      </div>
                      <p className="text-xs font-bold text-neutral-500">Tap to swap screenshot</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 bg-white border border-neutral-100 shadow-sm text-neutral-400 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:shadow-xl transition-all duration-300">
                        <Upload className="w-7 h-7" />
                      </div>
                      <div>
                        <p className="text-neutral-900 font-bold text-lg">Drop your screenshot here</p>
                        <p className="text-neutral-400 text-sm mt-1">High resolution PNG or JPG preferred</p>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={runEvaluation}
                  disabled={!file || isProcessing}
                  className="w-full py-5 bg-neutral-900 hover:bg-black disabled:bg-neutral-200 disabled:text-neutral-400 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl shadow-neutral-200 flex items-center justify-center gap-3 active:scale-[0.98]"
                >
                  {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                  Perform UX Audit
                </button>
              </div>
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="max-w-md mx-auto mt-32 text-center space-y-8 animate-in fade-in slide-in-from-bottom-8">
            <div className="relative inline-block">
              <div className="absolute inset-0 bg-[rgba(59,130,246,0.1)] blur-[80px] animate-pulse rounded-full"></div>
              <div className="relative w-28 h-28 bg-white rounded-3xl shadow-2xl flex items-center justify-center border border-neutral-100">
                <div className="relative">
                  <div className="w-12 h-12 border-4 border-neutral-100 border-t-neutral-900 rounded-full animate-spin"></div>
                  <Target className="absolute inset-0 m-auto w-5 h-5 text-neutral-900" />
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="text-2xl font-black text-neutral-900 uppercase tracking-tight">Applying Heuristics</h3>
              <p className="text-neutral-500 font-medium tracking-wide">{loadingStep}</p>
            </div>
          </div>
        )}

        {results && !isProcessing && (
          <div ref={reportRef} className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in fade-in duration-700 p-4 -m-4 rounded-2xl bg-[#F8F9FA]">
            {/* Left: Interactive Visualization */}
            <div className="lg:col-span-5 xl:col-span-6 space-y-6">
              <div className={`bg-white rounded-3xl border border-neutral-200 p-3 shadow-xl ${!isExporting ? 'sticky top-24' : ''}`}>
                <div className="relative rounded-2xl overflow-hidden bg-neutral-100 border border-neutral-100 ring-1 ring-neutral-200">
                  {previewUrl && <img src={previewUrl} alt="Analyzed UI" className="w-full h-auto block" />}
                  {results.critiques.map((c: any) => {
                    if (!c.box) return null;
                    const [ymin, xmin, ymax, xmax] = c.box;
                    const isFocused = hoveredId === c.id;
                    return (
                      <div
                        key={c.id}
                        className={`absolute border-2 transition-all duration-300 rounded cursor-pointer ${isFocused ? 'border-neutral-900 bg-[rgba(23,23,23,0.1)] z-20 scale-[1.01] shadow-2xl ring-4 ring-[rgba(23,23,23,0.2)]' : 'border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.05)]'}`}
                        style={{
                          top: `${(ymin / 1000) * 100}%`,
                          left: `${(xmin / 1000) * 100}%`,
                          height: `${((ymax - ymin) / 1000) * 100}%`,
                          width: `${((xmax - xmin) / 1000) * 100}%`,
                        }}
                        onMouseEnter={() => setHoveredId(c.id)}
                        onMouseLeave={() => setHoveredId(null)}
                      >
                        {isFocused && (
                          <div className="absolute -top-10 left-0 bg-neutral-900 text-white text-[10px] font-black px-2.5 py-1.5 rounded-lg shadow-2xl whitespace-nowrap animate-in slide-in-from-bottom-2 flex items-center gap-1.5">
                            <Maximize2 className="w-3 h-3" />
                            {c.id.toUpperCase()}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right: Scores & Audit List */}
            <div className="lg:col-span-7 xl:col-span-6 space-y-8">
              {/* Score Dashboard */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="bg-white p-7 rounded-[28px] border border-neutral-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-1">Aesthetics</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-5xl font-black text-neutral-900">{results.scores.aesthetics.val}</span>
                      <span className="text-sm font-bold text-neutral-300">/10</span>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-neutral-50">
                    <p className="text-[10px] font-bold text-neutral-400 leading-tight italic">
                      {results.scores.aesthetics.rationale.substring(0, 80)}...
                    </p>
                  </div>
                </div>

                <div className="bg-white p-7 rounded-[28px] border border-neutral-200 shadow-sm flex flex-col justify-between">
                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-1">Usability</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-5xl font-black text-neutral-900">{results.scores.usability.val}</span>
                        <span className="text-sm font-bold text-neutral-300">/10</span>
                      </div>
                    </div>
                    
                    <div className="space-y-3 pt-2">
                      <ScoreBar 
                        label="Learnability" 
                        val={results.scores.learnability.val} 
                        max={5} 
                        icon={ImageIcon} 
                        colorClass="bg-blue-500"
                      />
                      <ScoreBar 
                        label="Efficiency" 
                        val={results.scores.efficiency.val} 
                        max={5} 
                        icon={Zap} 
                        colorClass="bg-amber-500"
                      />
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-neutral-50">
                    <p className="text-[10px] font-medium text-neutral-500 leading-relaxed">
                      {results.scores.usability.rationale}
                    </p>
                  </div>
                </div>

                <div className="bg-neutral-900 p-7 rounded-[28px] shadow-2xl shadow-neutral-300 relative overflow-hidden group">
                  <div className="absolute -top-4 -right-4 p-8 opacity-20 group-hover:scale-110 transition-transform duration-700">
                    <Zap className="w-20 h-20 text-white fill-current" />
                  </div>
                  <div className="relative z-10">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-1">Overall</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-6xl font-black text-white">{results.scores.overall.val}</span>
                      <span className="text-sm font-bold text-neutral-600">/10</span>
                    </div>
                    <div className="mt-6">
                      <div className="h-1.5 w-full bg-neutral-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-white transition-all duration-[1500ms]" 
                          style={{ width: `${(results.scores.overall.val / 10) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Rationale Summary Card */}
              <div className="bg-[rgba(239,246,255,0.4)] p-6 rounded-[24px] border border-[rgba(219,234,254,0.5)]">
                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                    <Info className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-[11px] font-black text-blue-900 uppercase tracking-widest mb-1.5">Executive Summary</p>
                    <p className="text-sm text-[rgba(30,64,175,0.8)] leading-relaxed font-medium">
                      {results.scores.overall.rationale}
                    </p>
                  </div>
                </div>
              </div>

              {/* Heuristic Audit List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-xl font-bold tracking-tight text-neutral-900 flex items-center gap-3">
                    12-Point Heuristic Audit
                    <span className="text-[10px] bg-neutral-900 text-white px-2 py-0.5 rounded-full font-black uppercase">
                      {results.critiques.length} Findings
                    </span>
                  </h3>
                </div>
                
                <div className={`space-y-4 pr-2 ${!isExporting ? 'max-h-[800px] overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-200' : ''}`}>
                  {results.critiques.map((c: any) => (
                    <div
                      key={c.id}
                      onMouseEnter={() => setHoveredId(c.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      className={`bg-white rounded-3xl border transition-all duration-300 group ${hoveredId === c.id ? 'border-neutral-900 shadow-xl -translate-y-1' : 'border-neutral-200 hover:border-neutral-300'}`}
                    >
                      <div className="p-6 space-y-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="bg-neutral-900 text-white text-[10px] font-black px-2 py-0.5 rounded-lg uppercase">
                              {c.id}
                            </span>
                            <SeverityBadge severity={c.severity} />
                            <span className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.15em] flex items-center gap-1.5">
                              <Layout className="w-3 h-3" />
                              {c.evaluationDimension}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                              <CheckCircle2 className="w-3 h-3" /> Standard
                            </p>
                            <p className="text-sm text-neutral-600 leading-relaxed font-medium">{c.standard}</p>
                          </div>
                          <div className="space-y-2">
                            <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-2">
                              <AlertCircle className="w-3 h-3" /> The Gap
                            </p>
                            <p className="text-sm text-neutral-900 leading-relaxed font-bold">{c.gap}</p>
                          </div>
                        </div>

                        <div className="pt-5 border-t border-neutral-50">
                          <div className="bg-blue-600 p-4 rounded-2xl group-hover:bg-blue-700 transition-colors border border-blue-500 shadow-sm">
                            <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest mb-2">Recommended Fix</p>
                            <p className="text-sm text-white leading-relaxed font-bold italic">
                              "{c.recommendedFix}"
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-8 border-t border-neutral-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-neutral-100 rounded-lg flex items-center justify-center">
                    <Target className="w-4 h-4 text-neutral-400" />
                  </div>
                  <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">
                    Generated by Gemini Vision Engine
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="max-w-md mx-auto mt-20 p-8 bg-red-50 border border-red-100 rounded-[32px] flex flex-col items-center text-center gap-5 shadow-2xl shadow-red-200">
            <div className="w-16 h-16 bg-red-100 rounded-3xl flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-red-900 tracking-tight">Audit Failed</h3>
              <p className="text-sm text-[rgba(185,28,28,0.8)] mt-2 font-medium">{error}</p>
            </div>
            <button 
              onClick={() => setError(null)} 
              className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all"
            >
              Retry Analysis
            </button>
          </div>
        )}
      </main>

      <footer className="max-w-7xl mx-auto px-6 py-12 text-center border-t border-neutral-100 mt-20">
        <p className="text-xs font-black text-neutral-300 uppercase tracking-[0.4em]">UI Heuristic Framework v2.5.0</p>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          nav, button, footer, .sticky { display: none !important; }
          .max-w-7xl { max-width: 100% !important; margin: 0 !important; padding: 0 !important; }
          .grid { display: block !important; }
          .lg\\:col-span-7, .lg\\:col-span-5 { width: 100% !important; }
          .bg-white { box-shadow: none !important; border: 1px solid #eee !important; }
          .max-h-\\[800px\\] { max-height: none !important; overflow: visible !important; }
        }
        
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #E5E5E5; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #D4D4D4; }
      `}} />
    </div>
  );
}
