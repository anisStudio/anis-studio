export const KITCHEN_PRICING_ILLUSTRATION_PATHS = {
  basic: '/images/interijeri/kitchen-basic.webp',
  complex: '/images/interijeri/kitchen-complex.webp',
  advanced: '/images/interijeri/kitchen-advanced.webp',
} as const

export type KitchenIllustrationVariant = keyof typeof KITCHEN_PRICING_ILLUSTRATION_PATHS

interface KitchenPricingIllustrationSlotProps {
  variant: KitchenIllustrationVariant
  alt: string
}

export function KitchenPricingIllustrationSlot({
  variant,
  alt,
}: KitchenPricingIllustrationSlotProps) {
  return (
    <img
      src={KITCHEN_PRICING_ILLUSTRATION_PATHS[variant]}
      alt={alt}
      width={640}
      height={480}
      loading="lazy"
      decoding="async"
      className="aspect-[4/3] w-full shrink-0 object-cover object-center"
    />
  )
}
