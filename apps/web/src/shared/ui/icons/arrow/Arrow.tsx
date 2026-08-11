
import { SvgIconProps } from "@/shared/types/icon";


export const Arrow = ({size = '18', ...props }: SvgIconProps) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      {...props}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M6.64481 11.623L1.01981 5.99805C0.726841 5.73438 0.726841 5.29492 1.01981 5.00195C1.28348 4.73828 1.72294 4.73828 2.0159 5.00195L7.14286 10.1582L12.2698 5.03125C12.5335 4.73828 12.9729 4.73828 13.2659 5.03125C13.5296 5.29492 13.5296 5.73438 13.2659 5.99805L7.61161 11.623C7.34794 11.916 6.90848 11.916 6.64481 11.623Z"
        fill="currentColor"
      />
    </svg>
  );
};
