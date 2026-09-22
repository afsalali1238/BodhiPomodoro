// @ts-check
/** Brain module — LLM integration for evaluating user focus and generating pushback. */

const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const storage = require('./storage');

/** @typedef {'openai' | 'gemini'} Provider */
/** @typedef {{ provider: Provider, model: string, apiKey: string }} LLMConfig */

/** @type {LLMConfig|null} */
let brainConfig = null;

/** @type {any} */
let client = null;

/**
 * Initialize the LLM client from settings.
 * @returns {boolean} true if brain is available
 */
function initBrain() {
  const settings = storage.getSettings();
  const provider = settings.llmProvider || 'openai';
  const apiKey = settings.llmApiKey || '';
  const model = settings.llmModel || (provider === 'openai' ? 'gpt-4o-mini' : 'gemini-1.5-flash');

  if (!apiKey) {
    brainConfig = null;
    client = null;
    return false;
  }

  brainConfig = { provider, model, apiKey };

  if (provider === 'openai') {
    try {
      const OpenAI = require('openai');
      client = new OpenAI({ apiKey });
    } catch (e) {
      console.warn('[brain] openai package not available:', e.message);
      client = null;
      return false;
    }
  } else if (provider === 'gemini') {
    try {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKey);
      client = genAI.getGenerativeModel({ model });
    } catch (e) {
      console.warn('[brain] @google/generative-ai package not available:', e.message);
      client = null;
      return false;
    }
  }

  return !!client;
}

/**
 * Build the evaluation prompt for the LLM.
 * @param {string} goal
 * @param {string[]} activityLog
 * @returns {string}
 */
function buildPrompt(goal, activityLog) {
  const recent = activityLog.slice(-15);
  const activityStr = recent.length ? recent.map(a => `- ${a}`).join('\n') : 'No activity recorded yet.';

  return `You are 'Bodhi', a strict but helpful AI Tech Lead.
The user's declared goal for this session is: "${goal}"
Here is their activity log for the last 15 minutes:
${activityStr}

Your task:
1. Determine if their activity aligns with their goal.
2. If they are ON TRACK, output exactly: "OK"
3. If they are OFF TRACK (distracted, procrastinating, or over-engineering), provide a short, sharp pushback message (max 2 sentences). Call out specifically what they are doing wrong and remind them of the goal.`;
}

/**
 * Evaluate user activity against goal using LLM.
 * @param {string} goal
 * @param {string[]} activityLog
 * @returns {Promise<string>} 'OK' or pushback message
 */
async function evaluate(goal, activityLog) {
  if (!client || !brainConfig) return 'OK';

  const prompt = buildPrompt(goal, activityLog);

  try {
    if (brainConfig.provider === 'openai') {
      const response = await client.chat.completions.create({
        model: brainConfig.model,
        messages: [
          {
            role: 'system',
            content: 'You are Bodhi, an assertive AI Tech Lead. Respond only with \'OK\' or a pushback message.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 100
      });
      return response.choices[0].message.content.trim();
    } else if (brainConfig.provider === 'gemini') {
      const result = await client.generateContent(prompt);
      return result.response.text().trim();
    }
  } catch (e) {
    console.error('[brain] Evaluation error:', e.message);
  }

  return 'OK';
}

/**
 * Suggest the next high-priority task based on codebase state.
 * @param {string} goal
 * @param {string} gitDiff
 * @param {string[]} recentFiles
 * @returns {Promise<string>}
 */
async function suggestNextTask(goal, gitDiff, recentFiles) {
  if (!client || !brainConfig) return 'Brain not available (no API key configured)';

  // Get git context
  const { execSync } = require('child_process');
  const projectPath = app?.getPath('userData') || process.cwd();

  let recentCommits = 'No recent commits';
  let gitStatus = 'Clean';

  try {
    recentCommits = execSync('git log -n 3 --oneline', { cwd: projectPath, timeout: 5000, encoding: 'utf8' }).trim() || 'No recent commits';
  } catch { }

  try {
    gitStatus = execSync('git status --short', { cwd: projectPath, timeout: 5000, encoding: 'utf8' }).trim() || 'Clean';
  } catch { }

  const prompt = `Based on this git state and the user's current goal, what is the single most logical next coding task? Provide it as a 1-sentence instruction.

Goal: "${goal}"

Recent Commits:
${recentCommits}

Current Uncommitted State:
${gitStatus}

File Changes (stat):
${gitDiff?.slice(0, 2000) || 'No uncommitted changes'}

Recent file activity:
${recentFiles.slice(-10).map(f => `- ${f}`).join('\n')}`;

  try {
    if (brainConfig.provider === 'openai') {
      const response = await client.chat.completions.create({
        model: brainConfig.model,
        messages: [
          {
            role: 'system',
            content: 'You are Bodhi, an AI Tech Lead. Output one specific next task as a single sentence.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.4,
        max_tokens: 150
      });
      return response.choices[0].message.content.trim();
    } else if (brainConfig.provider === 'gemini') {
      const result = await client.generateContent(prompt);
      return result.response.text().trim();
    }
  } catch (e) {
    console.error('[brain] Next task suggestion error:', e.message);
  }

  return 'Continue with current task.';
}

/**
 * Check if brain is configured and available.
 * @returns {boolean}
 */
function isAvailable() {
  return !!client && !!brainConfig;
}

/**
 * Get current brain configuration (for settings display).
 * @returns {{ provider: string, model: string, available: boolean }}
 */
function getConfig() {
  return {
    provider: brainConfig?.provider || 'none',
    model: brainConfig?.model || 'none',
    available: isAvailable()
  };
}

module.exports = {
  initBrain,
  evaluate,
  suggestNextTask,
  isAvailable,
  getConfig
};