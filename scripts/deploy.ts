import hre, { ethers } from "hardhat";
import dotenv from "dotenv";
import fs from "fs";

async function main() {
  const network = hre.network.name;
  const envConfig = dotenv.parse(fs.readFileSync(`.env-${network}`));
  for (const parameter in envConfig) {
    process.env[parameter] = envConfig[parameter];
  }
  const Staking = await ethers.getContractFactory("Staking");
  const staking = await Staking.deploy(
    process.env.STAKING_TOKEN as string,
    process.env.REWARD_TOKEN as string
  );

  await staking.deployed();

  console.log("Staking deployed to:", staking.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
