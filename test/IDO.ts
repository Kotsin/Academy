import { expect } from "chai";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { ethers } from "hardhat";
// eslint-disable-next-line node/no-missing-import
import { CustomToken, IDO } from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

// variables
let usdc: CustomToken;
let tst: CustomToken;
let presale: IDO;
let owner: SignerWithAddress;
let accounts: SignerWithAddress[];
let vesting; // 1 month 10%, 2 month 30%, 3 month 50%, 4 month 100%.
let startTime = 0;
let endTime: number;

// constants
const tstDecimals = 18;
const uscDecimals = 6;
const price = 200000;
const minAmount = ethers.utils.parseUnits("10", tstDecimals);
const maxAmount = ethers.utils.parseUnits("100", tstDecimals);
const goal = ethers.utils.parseUnits("2000", uscDecimals);
const totalTST = ethers.utils.parseUnits("5000", tstDecimals);

describe("IDO", function () {
  async function deployFixture() {
    [owner, ...accounts] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("CustomToken");
    usdc = await Token.deploy("USD  TOKEN", "USD", uscDecimals);
    tst = await Token.deploy("Test  TOKEN", "TST", tstDecimals);
    const Presale = await ethers.getContractFactory("IDO");
    startTime = await time.latest();
    endTime = startTime + 259200;
    vesting = [
      { unlockTime: endTime + 2592000, unlockPercent: 10000 },
      { unlockTime: endTime + 2592000 * 2, unlockPercent: 20000 },
      { unlockTime: endTime + 2592000 * 3, unlockPercent: 20000 },
      { unlockTime: endTime + 2592000 * 4, unlockPercent: 50000 },
    ];
    presale = await Presale.deploy(
      startTime,
      endTime,
      tst.address,
      usdc.address,
      price,
      minAmount,
      maxAmount,
      vesting
    );
    await presale.deployed();

    for (let i = 0; i < 10; i++) {
      await usdc.mint(accounts[i].address, ethers.utils.parseEther("100"));
    }
  }

  async function deployInitFixture() {
    [owner, ...accounts] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("CustomToken");
    usdc = await Token.deploy("USD  TOKEN", "USD", uscDecimals);
    tst = await Token.deploy("Test  TOKEN", "TST", tstDecimals);
    const Presale = await ethers.getContractFactory("IDO");
    startTime = await time.latest();
    endTime = startTime + 259200;
    vesting = [
      { unlockTime: endTime + 2592000, unlockPercent: 10000 },
      { unlockTime: endTime + 2592000 * 2, unlockPercent: 20000 },
      { unlockTime: endTime + 2592000 * 3, unlockPercent: 20000 },
      { unlockTime: endTime + 2592000 * 4, unlockPercent: 50000 },
    ];
    presale = await Presale.deploy(
      startTime,
      endTime,
      tst.address,
      usdc.address,
      price,
      minAmount,
      maxAmount,
      vesting
    );
    await presale.deployed();

    await tst.connect(owner).approve(presale.address, totalTST);
    await presale.initialize(goal);

    for (let i = 0; i < 10; i++) {
      await usdc.mint(accounts[i].address, ethers.utils.parseEther("100"));
    }
  }

  async function deployLateStartTimeFixture() {
    [owner, ...accounts] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("CustomToken");
    usdc = await Token.deploy("USD  TOKEN", "USD", uscDecimals);
    tst = await Token.deploy("Test  TOKEN", "TST", tstDecimals);
    const Presale = await ethers.getContractFactory("IDO");
    startTime = (await time.latest()) + 100;
    endTime = startTime + 259200;
    vesting = [
      { unlockTime: endTime + 2592000, unlockPercent: 10000 },
      { unlockTime: endTime + 2592000 * 2, unlockPercent: 20000 },
      { unlockTime: endTime + 2592000 * 3, unlockPercent: 20000 },
      { unlockTime: endTime + 2592000 * 4, unlockPercent: 50000 },
    ];
    presale = await Presale.deploy(
      startTime,
      endTime,
      tst.address,
      usdc.address,
      price,
      minAmount,
      maxAmount,
      vesting
    );
    await presale.deployed();

    await tst.connect(owner).approve(presale.address, totalTST);
    await presale.initialize(goal);

    for (let i = 0; i < 10; i++) {
      await usdc.mint(accounts[i].address, ethers.utils.parseEther("100"));
    }
  }

  describe("Initialize", () => {
    it("Should be only callable by owner", async () => {
      await loadFixture(deployFixture);
      await tst.connect(accounts[0]).approve(presale.address, totalTST);
      await expect(
        presale.connect(accounts[0]).initialize(goal)
      ).to.be.revertedWith("not an admin");
    });

    it("Should be initialized correctly", async () => {
      await loadFixture(deployFixture);
      await tst.connect(owner).approve(presale.address, totalTST);
      await presale.initialize(goal);
      expect(await presale.startTime()).to.be.eq(startTime);
      expect(await presale.endTime()).to.be.eq(endTime);
      expect(await presale.price()).to.be.eq(price);
      expect(await presale.minAmount()).to.be.eq(minAmount);
      expect(await presale.maxAmount()).to.be.eq(maxAmount);
      expect(await presale.goal()).to.be.eq(goal);
      expect(await presale.totalUSDCAccumulated()).to.be.eq(0);
      expect(await presale.totalTSTSold()).to.be.eq(0);
      expect(await presale.usdc()).to.be.eq(usdc.address);
      expect(await presale.usdc()).to.be.eq(usdc.address);
      expect(await presale.tst()).to.be.eq(tst.address);
    });

    it("Should be unable to initialize twice", async () => {
      await loadFixture(deployInitFixture);
      await expect(presale.initialize(goal)).to.be.revertedWith(
        "already initialized"
      );
    });
  });

  describe("Buy Tokens", () => {
    it("Should buy tokens correctly", async () => {
      await loadFixture(deployInitFixture);
      const tstAmount = ethers.utils.parseUnits("100", tstDecimals);
      const usdcAmount = ethers.utils.parseUnits("200", uscDecimals);
      await usdc.connect(accounts[0]).approve(presale.address, usdcAmount);
      await presale.connect(accounts[0]).buyToken(tstAmount);
      expect((await presale.users(accounts[0].address)).bought).to.be.eq(
        tstAmount
      );
      expect(await usdc.balanceOf(presale.address)).to.be.eq(usdcAmount);
    });

    it("Should be able to buy tokens multiple times", async () => {
      await loadFixture(deployInitFixture);
      const tstAmount = ethers.utils.parseUnits("50", tstDecimals);
      const usdcAmount = ethers.utils.parseUnits("100", uscDecimals);
      await usdc
        .connect(accounts[0])
        .approve(presale.address, usdcAmount.mul(2));
      await presale.connect(accounts[0]).buyToken(tstAmount);
      await presale.connect(accounts[0]).buyToken(tstAmount);
      expect((await presale.users(accounts[0].address)).bought).to.be.eq(
        tstAmount.mul(2)
      );
      expect(await usdc.balanceOf(presale.address)).to.be.eq(usdcAmount.mul(2));
    });

    it("Should be unable to buy less then 10 tokens", async () => {
      await loadFixture(deployInitFixture);
      const tstAmount = ethers.utils.parseUnits("9", tstDecimals);
      const usdcAmount = ethers.utils.parseUnits("200", uscDecimals);
      await usdc.connect(accounts[0]).approve(presale.address, usdcAmount);
      await expect(
        presale.connect(accounts[0]).buyToken(tstAmount)
      ).to.be.revertedWith("bad amount");
      expect((await presale.users(accounts[0].address)).bought).to.be.eq(0);
      expect(await usdc.balanceOf(presale.address)).to.be.eq(0);
    });

    it("Should be unable to buy more than max amount", async () => {
      await loadFixture(deployInitFixture);
      const tstAmount = ethers.utils.parseUnits("100", tstDecimals);
      const usdcAmount = ethers.utils.parseUnits("200", uscDecimals);
      for (let i = 0; i < 10; i++) {
        await usdc.connect(accounts[i]).approve(presale.address, usdcAmount);
        await presale.connect(accounts[i]).buyToken(tstAmount);
      }
      await expect(
        presale.connect(accounts[10]).buyToken(tstAmount)
      ).to.be.revertedWith("amount too high");
      expect(await presale.totalUSDCAccumulated()).to.be.eq(
        await presale.goal()
      );
      expect(await usdc.balanceOf(presale.address)).to.be.eq(
        await presale.goal()
      );
      expect(await presale.totalTSTSold()).to.be.eq(tstAmount.mul(10));
    });

    it("Should be unable to buy more then 100 tokens", async () => {
      await loadFixture(deployInitFixture);
      const tstAmount = ethers.utils.parseUnits("51", tstDecimals);
      const usdcAmount = ethers.utils.parseUnits("204", uscDecimals);
      await usdc.connect(accounts[0]).approve(presale.address, usdcAmount);
      await presale.connect(accounts[0]).buyToken(tstAmount);
      await expect(
        presale.connect(accounts[0]).buyToken(tstAmount)
      ).to.be.revertedWith("bad amount");
      expect((await presale.users(accounts[0].address)).bought).to.be.eq(
        tstAmount
      );
      expect(await usdc.balanceOf(presale.address)).to.be.eq(
        ethers.utils.parseUnits("102", uscDecimals)
      );
    });

    it("Should be unable to buy tokens after endTime", async () => {
      await loadFixture(deployInitFixture);
      const tstAmount = ethers.utils.parseUnits("51", tstDecimals);
      const usdcAmount = ethers.utils.parseUnits("102", uscDecimals);
      await usdc.connect(accounts[0]).approve(presale.address, usdcAmount);
      await time.increaseTo(endTime);
      await expect(
        presale.connect(accounts[0]).buyToken(tstAmount)
      ).to.be.revertedWith("too late");
      expect((await presale.users(accounts[0].address)).bought).to.be.eq(0);
      expect(await usdc.balanceOf(presale.address)).to.be.eq(0);
    });

    // it("Should be unable to buy tokens before startTime", async () => {
    //   await loadFixture(deployInitFixture);
    //   const tstAmount = ethers.utils.parseUnits("51", tstDecimals);
    //   const usdcAmount = ethers.utils.parseUnits("102", uscDecimals);
    //   await usdc.connect(accounts[0]).approve(presale.address, usdcAmount);
    //   await expect(
    //     presale.connect(accounts[0]).buyToken(tstAmount)
    //   ).to.be.revertedWith("too early");
    //   expect((await presale.users(accounts[0].address)).bought).to.be.eq(0);
    //   expect(await usdc.balanceOf(presale.address)).to.be.eq(0);
    // });
  });

  describe("Withdraw Tokens", () => {
    it("Should be unable to withdraw before vesting starts", async () => {
      await loadFixture(deployInitFixture);
      const tstAmount = ethers.utils.parseUnits("100", tstDecimals);
      const usdcAmount = ethers.utils.parseUnits("200", uscDecimals);
      await usdc.connect(accounts[0]).approve(presale.address, usdcAmount);
      await presale.connect(accounts[0]).buyToken(tstAmount);

      await time.increaseTo((await presale.endTime()).add(100));
      await expect(
        presale.connect(accounts[0]).withdrawTokens()
      ).to.be.revertedWith("Time have not came");
      expect(await tst.balanceOf(accounts[0].address)).to.be.eq(0);
    });

    it("Should be unable to withdraw before endTime", async () => {
      await loadFixture(deployInitFixture);
      const tstAmount = ethers.utils.parseUnits("100", tstDecimals);
      const usdcAmount = ethers.utils.parseUnits("200", uscDecimals);
      await usdc.connect(accounts[0]).approve(presale.address, usdcAmount);
      await presale.connect(accounts[0]).buyToken(tstAmount);

      await expect(
        presale.connect(accounts[0]).withdrawTokens()
      ).to.be.revertedWith("too early");
      expect(await tst.balanceOf(accounts[0].address)).to.be.eq(0);
    });
  });
});
