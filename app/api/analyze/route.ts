import { NextRequest, NextResponse } from 'next/server';

// ── Types shared with frontend ─────────────────────────────────────────────────
export interface GateInput {
  id: string;
  name: string;
  density: number;
  queueLength: number;
  waitTime: number;
}

export interface AIAnalysis {
  overallStatus: 'calm' | 'busy' | 'critical';
  summary: string;
  fanRecommendation: {
    gateId: string;
    gateName: string;
    reason: string;
    estimatedWait: number;
  };
  alerts: {
    gateId: string;
    message: string;
    severity: 'info' | 'warning' | 'critical';
    action: string;
  }[];
  predictions: {
    gateId: string;
    in15min: number;
    trend: 'up' | 'down' | 'stable';
    reasoning: string;
  }[];
  securityActions: {
    gateId: string;
    priority: 'low' | 'medium' | 'high';
    action: string;
    staffNeeded: number;
  }[];
}

// ── Deterministic fallback (same output shape as AI) ──────────────────────────
function algorithmicAnalysis(gates: GateInput[]): AIAnalysis {
  const sorted    = [...gates].sort((a, b) => a.density - b.density);
  const best      = sorted[0];
  const worst     = sorted[sorted.length - 1];
  const criticals = gates.filter(g => g.density > 80);
  const warnings  = gates.filter(g => g.density > 60 && g.density <= 80);

  const overallStatus: AIAnalysis['overallStatus'] =
    criticals.length >= 2 ? 'critical' :
    criticals.length >= 1 || warnings.length >= 3 ? 'busy' : 'calm';

  const alerts: AIAnalysis['alerts'] = [
    ...criticals.map(g => ({
      gateId: g.id,
      message: `${g.name} is at ${g.density}% — queue of ${g.queueLength} people with ${g.waitTime} min wait`,
      severity: 'critical' as const,
      action: `Open additional turnstile lanes and redirect incoming fans away from ${g.name}`,
    })),
    ...warnings.map(g => ({
      gateId: g.id,
      message: `${g.name} building up to ${g.density}% — monitor closely`,
      severity: 'warning' as const,
      action: `Assign one additional steward to ${g.name} to manage flow`,
    })),
    ...gates.filter(g => g.density < 35).map(g => ({
      gateId: g.id,
      message: `${g.name} is underutilised at ${g.density}% — capacity available`,
      severity: 'info' as const,
      action: `Redirect fans via PA announcement to ${g.name} to balance load`,
    })),
  ];

  const predictions: AIAnalysis['predictions'] = gates.map(g => {
    const bias   = g.density > 75 ? 10 : g.density < 40 ? -8 : 1;
    const jitter = Math.round((Math.random() - 0.5) * 10);
    const pred   = Math.round(Math.max(8, Math.min(97, g.density + bias + jitter)));
    const trend  = pred > g.density + 4 ? 'up' : pred < g.density - 4 ? 'down' : 'stable';
    return {
      gateId: g.id,
      in15min: pred,
      trend,
      reasoning:
        trend === 'up'   ? `Pre-match surge expected — ${g.name} will intensify in the next 15 minutes` :
        trend === 'down' ? `Crowd dispersing at ${g.name} — conditions should improve shortly` :
                           `${g.name} maintaining steady flow — no major change predicted`,
    };
  });

  const securityActions: AIAnalysis['securityActions'] = gates
    .filter(g => g.density > 55)
    .sort((a, b) => b.density - a.density)
    .map(g => ({
      gateId: g.id,
      priority: g.density > 80 ? 'high' : g.density > 65 ? 'medium' : 'low',
      action:
        g.density > 85 ? `Deploy emergency crowd control to ${g.name} — open all available lanes immediately` :
        g.density > 70 ? `Send 2 additional stewards to ${g.name} and open a secondary lane` :
                         `Monitor ${g.name} — ready standby steward for deployment`,
      staffNeeded: g.density > 85 ? 4 : g.density > 70 ? 2 : 1,
    }));

  return {
    overallStatus,
    summary:
      overallStatus === 'critical'
        ? `⚠️ Critical congestion detected at ${criticals.map(g => g.name).join(' and ')}. Immediate staff deployment required.`
        : overallStatus === 'busy'
          ? `Moderate crowd pressure across ${criticals.length + warnings.length} gates. Pre-emptive action recommended.`
          : `Crowd flow is healthy across all gates. No immediate action required.`,
    fanRecommendation: {
      gateId: best.id,
      gateName: best.name,
      reason:
        best.density < 35
          ? `${best.name} is almost empty right now — walk straight through`
          : best.density < 55
            ? `${best.name} is your fastest option with a manageable ${best.waitTime} min wait`
            : `${best.name} is the least congested gate available — ${best.waitTime} min estimated wait`,
      estimatedWait: best.waitTime,
    },
    alerts: alerts.slice(0, 8),
    predictions,
    securityActions,
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { gates }: { gates: GateInput[] } = await req.json();

    // Groq is free — sign up at console.groq.com, no credit card needed
    // Azure is also supported as a fallback if AZURE_OPENAI_KEY is set instead
    const groqKey     = process.env.GROQ_API_KEY;
    const azureKey    = process.env.AZURE_OPENAI_KEY;
    const azureEndpoint   = process.env.AZURE_OPENAI_ENDPOINT;
    const azureDeployment = process.env.AZURE_OPENAI_DEPLOYMENT ?? 'gpt-4o-mini';
    const azureApiVersion = process.env.AZURE_OPENAI_API_VERSION ?? '2024-02-01';

    if (!groqKey && (!azureKey || !azureEndpoint)) {
      return NextResponse.json({ analysis: algorithmicAnalysis(gates), source: 'algorithm' });
    }

    // Sort gates by density so AI sees worst first
    const sortedGates = [...gates].sort((a, b) => b.density - a.density);

    const avgDensity   = Math.round(gates.reduce((s, g) => s + g.density, 0) / gates.length);
    const totalQueue   = gates.reduce((s, g) => s + g.queueLength, 0);
    const avgWait      = Math.round(gates.reduce((s, g) => s + g.waitTime, 0) / gates.length);
    const criticalGates = gates.filter(g => g.density > 80).map(g => g.name).join(', ') || 'none';
    const clearGates    = gates.filter(g => g.density < 40).map(g => g.name).join(', ') || 'none';
    const bestGate      = sortedGates[sortedGates.length - 1];
    const worstGate     = sortedGates[0];

    const gateTable = sortedGates
      .map(g => {
        const status = g.density > 80 ? '🔴 CRITICAL' : g.density > 60 ? '🟡 MODERATE' : '🟢 CLEAR';
        return `  ${status} | ${g.name.padEnd(12)} | id: ${g.id.padEnd(12)} | ${String(g.density).padStart(2)}% capacity | ${String(g.queueLength).padStart(3)} people | ~${g.waitTime} min wait`;
      })
      .join('\n');

    const prompt = `You are the AI decision engine for SmartCrowd — a real-time stadium entrance crowd management system.
Your analysis drives EVERY decision shown to fans, security staff, and operators. Be precise and actionable.

━━━ LIVE SENSOR DATA — ${new Date().toLocaleTimeString('en-GB')} ━━━

STADIUM OVERVIEW:
  • Total fans currently queuing: ${totalQueue.toLocaleString()}
  • Average gate capacity: ${avgDensity}%
  • Average wait time: ${avgWait} min
  • Critical gates (>80%): ${criticalGates}
  • Clear gates (<40%): ${clearGates}
  • Best gate right now: ${bestGate.name} (${bestGate.density}%, ~${bestGate.waitTime} min)
  • Worst gate right now: ${worstGate.name} (${worstGate.density}%, ~${worstGate.waitTime} min)

GATE-BY-GATE STATUS (sorted worst to best):
${gateTable}

━━━ YOUR TASK ━━━
Analyse ALL of the above data and return a JSON decision object.
Consider: crowd surge risks, gate imbalance, pre-match timing, fan safety, staff efficiency.

Return ONLY a valid JSON object with this exact structure — no markdown, no explanation:
{
  "overallStatus": "calm" | "busy" | "critical",
  "summary": "1-2 sentence situation overview for operators",
  "fanRecommendation": {
    "gateId": "<id from data>",
    "gateName": "<name from data>",
    "reason": "natural language reason why this gate is best for fans right now",
    "estimatedWait": <number in minutes>
  },
  "alerts": [
    {
      "gateId": "<id>",
      "message": "specific alert message",
      "severity": "info" | "warning" | "critical",
      "action": "specific actionable instruction for staff"
    }
  ],
  "predictions": [
    {
      "gateId": "<id>",
      "in15min": <predicted density 0-100>,
      "trend": "up" | "down" | "stable",
      "reasoning": "short reason for this prediction"
    }
  ],
  "securityActions": [
    {
      "gateId": "<id>",
      "priority": "low" | "medium" | "high",
      "action": "specific instruction for security team",
      "staffNeeded": <number 1-6>
    }
  ]
}

Rules:
- Include ALL ${gates.length} gates in the predictions array — no exceptions
- securityActions: only gates with density > 55, sorted by priority (high first)
- alerts: only gates that genuinely need attention — include info alerts for underused gates too
- fanRecommendation MUST point to the gate with lowest density (${bestGate.name})
- summary must mention specific gate names and numbers, not generic statements
- predictions must reflect realistic 15-min trends based on current density and direction
- staffNeeded must be proportional: density 55-70 → 1-2 staff, 70-85 → 2-3, 85+ → 4-6
- Be specific: use real gate names, real numbers from the data`;

    let url: string;
    let headers: Record<string, string>;
    let body: Record<string, unknown>;

    if (groqKey) {
      // ── Groq (free, OpenAI-compatible) ──────────────────────────────────
      url     = 'https://api.groq.com/openai/v1/chat/completions';
      headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` };
      body    = {
        model: 'llama-3.3-70b-versatile',   // best free Groq model
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 900,
        temperature: 0.3,
        response_format: { type: 'json_object' },
      };
    } else {
      // ── Azure OpenAI ────────────────────────────────────────────────────
      url     = `${azureEndpoint!.replace(/\/$/, '')}/openai/deployments/${azureDeployment}/chat/completions?api-version=${azureApiVersion}`;
      headers = { 'Content-Type': 'application/json', 'api-key': azureKey! };
      body    = {
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 900,
        temperature: 0.3,
        response_format: { type: 'json_object' },
      };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error('AI API error:', response.status, await response.text());
      return NextResponse.json({ analysis: algorithmicAnalysis(gates), source: 'algorithm' });
    }

    const data     = await response.json();
    const analysis = JSON.parse(data.choices[0].message.content) as AIAnalysis;

    return NextResponse.json({ analysis, source: groqKey ? 'groq' : 'azure' });
  } catch (err) {
    console.error('Analyze route error:', err);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}
