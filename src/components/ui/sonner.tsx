import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Sonner toaster wrapper.
 *
 * FIX 21 BUG-E10: Pass `expand={false}` and `visibleToasts={3}` so that
 * stacked toasts are NOT given the inverted/scaled "stack" transform that
 * left visually-flipped ghosts (matrix(-0.05, 0, 0, -0.05, …)) behind in
 * the DOM during compose autosave bursts. Sonner removes elements after
 * its exit animation completes; we simply stop putting them into the
 * stacked layout in the first place.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      expand={false}
      visibleToasts={3}
      gap={8}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
