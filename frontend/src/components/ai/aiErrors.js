/**
 * Maps Axios errors from the AI endpoints into a friendly sentence.
 * Mirrors the mapping in AIGenerationWizard so every AI surface shows the
 * same wording for the same error code.
 */
export function describeAiError(err, fallback) {
  const detail = err?.response?.data?.detail;
  const title = err?.response?.data?.title;
  const status = err?.response?.status;
  if (status === 503 || title === 'AI.NotConfigured') {
    return 'AI is not configured on the server. Set GEMINI_API_KEY in the backend environment and restart the API.';
  }
  if (status === 502 || title === 'AI.ProviderFailed') {
    return 'The AI provider rejected the request. Check the backend logs and try again.';
  }
  if (status === 422 && title === 'AI.MissingAcceptanceCriteria') {
    return 'AI returned tasks without 2–5 acceptance criteria. Regenerate and try again.';
  }
  if (status === 422 && title === 'AI.InvalidDescription') {
    return 'Description must be 10–2000 characters.';
  }
  if (status === 422 && title === 'AI.EmptyResult') {
    return 'AI returned nothing useful. Try a more specific prompt.';
  }
  return detail ?? fallback;
}
