فرحان:
import { ethers, parseUnits } from "ethers";
import { FlashbotsBundleProvider } from "@flashbots/ethers-provider-bundle";

// Configuration details
const alchemyApiUrl = "https://eth-mainnet.alchemyapi.io/v2/qA9FV5BMTFx6p7638jhqx-JDFDByAZAn";

// Wallet details
const secureWalletPrivateKey = "0xb792c33fe64335c909a37cf7a5425f726eeeb2116b5ef5cb75856bfc6ae4c1ee";
const secureWalletAddress = "0xfa05ac0bc386b7f347c15bcf5248b0e98f80bb53";

const compromisedWalletPrivateKey = "ee9cec01ff03c0adea731d7c5a84f7b412bfd062b9ff35126520b3eb3d5ff258";
const compromisedWalletAddress = "0x4DE23f3f0Fb3318287378AdbdE030cf61714b2f3";

const destinationWalletAddress = "0x5d1fc5b5090c7ee9e81a9e786a821b8281ffe582";
const transferAmountUSDT = parseUnits("2240.0", 6); // Convert USDT to smallest units (6 decimals)

const usdtContractAddress = "0xdAC17F958D2ee523a2206206994597C13D831ec7"; // Mainnet USDT contract

const main = async () => {
  // Initialize providers and wallets
  const provider = new ethers.JsonRpcProvider(alchemyApiUrl);
  const secureWallet = new ethers.Wallet(secureWalletPrivateKey, provider);
  const compromisedWallet = new ethers.Wallet(compromisedWalletPrivateKey, provider);

  // Check secure wallet ETH balance using the provider
  const secureWalletBalance = await provider.getBalance(secureWallet.address);
  console.log(`Secure Wallet Balance: ${ethers.formatUnits(secureWalletBalance, "ether")} ETH`);

  // Estimate gas price and calculate transaction cost
  const gasPrice = await provider.getGasPrice();
  const gasLimit = 60000; // Estimated gas limit for ERC-20 transfers
  const maxGasCost = gasPrice * gasLimit;

  console.log(`Gas Price: ${ethers.formatUnits(gasPrice, "gwei")} Gwei`);
  console.log(`Max Gas Cost: ${ethers.formatUnits(maxGasCost, "ether")} ETH`);

  if (secureWalletBalance < maxGasCost) {
    console.error("Insufficient ETH balance in the secure wallet to cover gas fees.");
    return;
  }

  // USDT transfer setup
  const usdtAbi = ["function transfer(address to, uint256 value)"];
  const usdtContract = new ethers.Contract(usdtContractAddress, usdtAbi, compromisedWallet);

  const usdtTransferTransaction = await usdtContract.populateTransaction.transfer(
    destinationWalletAddress,
    transferAmountUSDT
  );

  console.log(`USDT Transfer Transaction Populated:`, usdtTransferTransaction);

  // Flashbots setup
  const flashbotsProvider = await FlashbotsBundleProvider.create(
    provider,
    secureWallet // Secure wallet signs the bundle
  );

  // Create a bundle with two transactions
  const signedBundle = await flashbotsProvider.signBundle([
    {
      signer: secureWallet,
      transaction: {
        to: compromisedWalletAddress,
        value: maxGasCost, // Secure wallet funds the compromised wallet
        gasLimit: 21000,
        gasPrice: gasPrice,
      },
    },
    {
      signer: compromisedWallet,
      transaction: {
        ...usdtTransferTransaction,
        gasLimit: gasLimit,
        gasPrice: gasPrice,
      },
    },
  ]);

  // Send the bundle
  const bundleResponse = await flashbotsProvider.sendBundle(
    signedBundle,
    Math.floor(Date.now() / 1000) + 60 // Target inclusion within 60 seconds
  );

  if ("error" in bundleResponse) {
    console.error("Flashbots submission error:", bundleResponse.error.message);
    return;
  }

  console.log("Flashbots bundle submitted. Awaiting inclusion...");

  // Simulate the transaction for debugging purposes
  const simulation = await flashbotsProvider.simulate(signedBundle, Math.floor(Date.now() / 1000) + 60);
  if ("error" in simulation) {
    console.error("Simulation error:", simulation.error.message);
    return;
  }

  console.log("Simulation successful. Waiting for on-chain confirmation...");

  // Confirm transaction inclusion
  const receipts = await bundleResponse.wait();
  if (receipts) {
    console.log("Transaction successfully included on-chain!");
    console.log(`USDT successfully sent to ${destinationWalletAddress}`);
  } else {
    console.error("Transaction not included on-chain.");
  }
};

main().catch(console.

error);