import { SvgIconProps } from "@/shared/types/icon";

const Telegram = ({ size = "27", ...props }: SvgIconProps) => {
  return (
    <svg width={size} height={size} viewBox="0 0 27 27" fill="none" {...props}>
      <path
        d="M22.46 3.62 19.3 20.08c-.24 1.17-.87 1.46-1.77.91l-5.72-4.21-2.76 2.66c-.31.3-.56.55-1.16.55l.42-5.97L19.18 4.2c.47-.41-.1-.64-.73-.22L5.02 12.43.22 10.93c-1.04-.33-1.06-1.04.22-1.54L21.2 1.4c.96-.36 1.8.22 1.26 2.22z"

    />
    </svg>
  );
};

export default Telegram;
