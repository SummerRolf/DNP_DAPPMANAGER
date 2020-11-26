import React from "react";
import logo from "img/dappnode-logo-wide-min.png";
import "./standaloneContainer.scss";
import { IconType } from "react-icons/lib";

export const StandaloneContainer: React.FC<{
  TopIcon: IconType;
  title: string;
}> = ({ TopIcon, title, children }) => (
  <div className="standalone-container">
    <div className="toplogo">
      <TopIcon />
    </div>

    <div className="title">{title}</div>

    {children}

    <div className="separator" />
    <img className="logo" src={logo} alt="logo" />
  </div>
);
