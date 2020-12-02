import React from "react";
import { IconType } from "react-icons/lib";
import { joinCssClass } from "utils/css";
import "./button.scss";

type ButtonType = "button" | "submit" | "reset" | undefined;

interface ButtonProps {
  variant?: string;
  pill?: boolean;
  fullwidth?: boolean;
  disabled?: boolean;
  type?: ButtonType;
  Icon?: IconType;
}

const Button: React.FC<ButtonProps &
  React.HTMLAttributes<HTMLButtonElement>> = ({
  variant,
  children,
  pill,
  fullwidth,
  className,
  disabled,
  Icon,
  ...props
}) => (
  <button
    className={joinCssClass(
      `btn btn-${variant || "outline-secondary"}`,
      { pill, fullwidth },
      className
    )}
    disabled={disabled}
    {...props}
  >
    {Icon ? (
      <span className="btn-with-icon">
        <Icon />
        <span>{children}</span>
      </span>
    ) : (
      children
    )}
  </button>
);

export const ButtonLight: typeof Button = props => (
  <Button variant={"outline-secondary"} {...props}>
    {props.children}
  </Button>
);

export default Button;
