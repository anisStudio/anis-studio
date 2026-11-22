interface DepartmentStepCardProps {
  number: number
  image: string
  title: string
  description: string
}

export function DepartmentStepCard({ number, image, title, description }: DepartmentStepCardProps) {
  return (
    <div className="relative flex w-full flex-col items-center rounded-2xl border border-[rgba(110,68,255,0.15)] bg-[rgba(248,246,255,0.72)] p-5 text-center shadow-sm backdrop-blur-sm dark:border-lavender/15 dark:bg-white/8 dark:shadow-[0_8px_30px_rgba(0,0,0,0.3)] fade-in">
      <div className="department-step-number absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-[#563078] text-sm font-bold text-white shadow-md dark:bg-[#6d4491]">
        {number}
      </div>
      <img
        src={image}
        alt=""
        width={144}
        height={96}
        loading="lazy"
        className="mb-3 h-24 w-36 max-w-[68%] object-contain"
      />
      <h4 className="mb-2 text-base font-bold leading-tight text-plum/95 dark:text-pearl">
        {title}
      </h4>
      <p className="max-w-none text-sm leading-relaxed text-plum/80 dark:text-pearl/80">
        {description}
      </p>
    </div>
  )
}
