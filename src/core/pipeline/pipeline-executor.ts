import { PipelineStep } from './pipeline-step';

export class PipelineExecutor {
  async execute<TInput, TOutput>(
    input: TInput,
    steps: PipelineStep<any, any>[]
  ): Promise<TOutput> {
    let result: any = input;
    for (const step of steps) {
      result = await step.execute(result);
    }
    return result as TOutput;
  }
}
