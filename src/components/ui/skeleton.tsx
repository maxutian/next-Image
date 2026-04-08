import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("animate-pulse rounded-[1.25rem] bg-secondary/80", className)}
      {...props}
    />
  );
}

export { Skeleton };
