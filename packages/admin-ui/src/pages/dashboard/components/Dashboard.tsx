import React from "react";
// Own module
import { title } from "../data";
import { ChainCards } from "./ChainCard";
import { HostStats } from "./HostStats";
import { PackageUpdates } from "./PackageUpdates";
// Components
import SubTitle from "components/SubTitle";
import Title from "components/Title";

import "./dashboard.scss";

export default function Dashboard() {
  return (
    <>
      <Title title={title} />

      <SubTitle>Package updates</SubTitle>
      <PackageUpdates />

      <SubTitle>Chains</SubTitle>
      <ChainCards />

      <SubTitle>Machine stats</SubTitle>
      <HostStats />
    </>
  );
}
