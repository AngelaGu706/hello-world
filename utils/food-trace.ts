import type { SupabaseClient } from '@supabase/supabase-js';

export class TracePersistenceError extends Error {
  constructor() { super('Could not record this recommendation. Please try again.'); }
}
export function traceErrorCode(error: unknown): string {
  if (error instanceof TracePersistenceError) return 'trace_write_failed';
  if (error && typeof error === 'object' && 'status' in error && typeof error.status === 'number') return `model_http_${error.status}`;
  if (error instanceof Error && error.name === 'NeighborhoodMatchError') return 'neighborhood_mismatch';
  return 'generation_failed';
}
type Pick = { title: string; content: string };
type Response = { text?: string; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number; thoughtsTokenCount?: number }; modelVersion?: string };

export class FoodTrace {
  constructor(private client: SupabaseClient, readonly id: string) {}
  private async rpc(name: string, args: Record<string, unknown>) {
    try {
      const { data, error } = await this.client.rpc(name, args);
      if (error) throw new TracePersistenceError();
      return data;
    } catch { throw new TracePersistenceError(); }
  }
  static async begin(client: SupabaseClient, input: string, cuisine: string | null, neighborhood: string | null) {
    try {
      const { data, error } = await client.rpc('food_start_request', { p_input: input, p_cuisine: cuisine, p_neighborhood: neighborhood });
      if (error || typeof data !== 'string') throw new TracePersistenceError();
      return new FoodTrace(client, data);
    } catch { throw new TracePersistenceError(); }
  }
  async step(model: string, prompt: string, settings: Record<string, unknown>, kind: 'recommendation' | 'variety_retry', call: () => Promise<Response>, validate: (text: string) => Pick) {
    const stepId = await this.rpc('food_start_step', { p_request_id: this.id, p_model: model, p_prompt: prompt, p_kind: kind, p_settings: settings });
    if (typeof stepId !== 'string') throw new TracePersistenceError();
    let response: Response | undefined;
    let pick: Pick | null = null;
    let failure: unknown;
    try {
      response = await call();
      if (!response.text?.trim()) throw new Error('Model returned no text');
      pick = validate(response.text);
    } catch (error) { failure = error; }
    const usage = response?.usageMetadata;
    await this.rpc('food_finish_step', {
      p_step_id: stepId,
      p_output: response?.text?.slice(0, 80000) ?? null,
      p_truncated: (response?.text?.length ?? 0) > 80000,
      p_result: pick, p_valid: Boolean(pick),
      p_usage: usage || response?.modelVersion ? {
        ...(usage ? { input_tokens: usage.promptTokenCount ?? null, output_tokens: usage.candidatesTokenCount ?? null, total_tokens: usage.totalTokenCount ?? null, thought_tokens: usage.thoughtsTokenCount ?? null } : {}),
        ...(response?.modelVersion ? { resolved_model: response.modelVersion } : {}),
      } : null,
      p_error_code: failure ? traceErrorCode(failure) : null,
    });
    if (failure) throw failure;
    if (!pick) throw new Error('No valid recommendation');
    return { pick, stepId };
  }
  async complete(stepId: string, pick: Pick, prompt: string) {
    const result = await this.rpc('food_complete_request', { p_request_id: this.id, p_step_id: stepId, p_title: pick.title, p_content: pick.content, p_prompt: prompt });
    if (!result || typeof result.id !== 'string') throw new TracePersistenceError();
    return result;
  }
  async fail(error: unknown) {
    await this.rpc('food_fail_request', { p_request_id: this.id, p_error_code: traceErrorCode(error) });
  }
}
