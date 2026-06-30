export function getStage() {
  const stage = process.argv[2] ?? process.env.ACO24_STAGE ?? process.env.AWS_PROFILE;

  if (!stage) {
    throw new Error("Stage is required. Set AWS_PROFILE, ACO24_STAGE, or pass the stage as the first argument.");
  }

  if (!["local", "testing", "staging", "production"].includes(stage)) {
    throw new Error(`Unknown stage: ${stage}`);
  }

  return stage;
}
