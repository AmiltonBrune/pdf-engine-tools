export interface PipelineStep<TInput, TOutput> {
  execute(input: TInput): Promise<TOutput>;
}
