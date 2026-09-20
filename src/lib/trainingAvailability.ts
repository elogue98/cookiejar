export function isTrainingEnabled(environment = process.env.NODE_ENV): boolean {
  return environment === 'development'
}
