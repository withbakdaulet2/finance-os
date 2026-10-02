import { LogOut } from "lucide-react";

import { signOut } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

export function SignOutButton({
  showLabel = true,
  className,
}: {
  showLabel?: boolean;
  className?: string;
}) {
  return (
    <form action={signOut}>
      <Button
        type="submit"
        variant="ghost"
        size={showLabel ? "default" : "icon"}
        className={className}
        aria-label="Sign out"
      >
        <LogOut />
        {showLabel && "Sign out"}
      </Button>
    </form>
  );
}
