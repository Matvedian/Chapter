export default function OnboardingStepHeader({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="mb-8">
      <h2 className="text-display text-2xl mb-1">{title}</h2>
      <p className="text-muted text-sm">{description}</p>
    </div>
  )
}
