import { z } from "zod";

export const NetworkSchema = z.enum([
  "abstract",
  "abstract-testnet",
  "aptos-mainnet",
  "aptos-testnet",
  "aptos-devnet",
  "base-sepolia",
  "base",
  "avalanche-fuji",
  "avalanche",
  "iotex",
  "solana-devnet",
  "solana",
  "sei",
  "sei-testnet",
  "polygon",
  "polygon-amoy",
  "peaq",
  "story",
]);
export type Network = z.infer<typeof NetworkSchema>;

// evm
export const SupportedEVMNetworks: Network[] = [
  "abstract",
  "abstract-testnet",
  "base-sepolia",
  "base",
  "avalanche-fuji",
  "avalanche",
  "iotex",
  "sei",
  "sei-testnet",
  "polygon",
  "polygon-amoy",
  "peaq",
  "story",
];
export const EvmNetworkToChainId = new Map<Network, number>([
  ["abstract", 2741],
  ["abstract-testnet", 11124],
  ["base-sepolia", 84532],
  ["base", 8453],
  ["avalanche-fuji", 43113],
  ["avalanche", 43114],
  ["iotex", 4689],
  ["sei", 1329],
  ["sei-testnet", 1328],
  ["polygon", 137],
  ["polygon-amoy", 80002],
  ["peaq", 3338],
  ["story", 1514],
]);

// svm
export const SupportedSVMNetworks: Network[] = ["solana-devnet", "solana"];
export const SvmNetworkToChainId = new Map<Network, number>([
  ["solana-devnet", 103],
  ["solana", 101],
]);

// aptos
export const SupportedAptosNetworks: Network[] = ["aptos-mainnet", "aptos-testnet", "aptos-devnet"];
export const AptosNetworkToChainId = new Map<Network, number>([
  ["aptos-mainnet", 1],
  ["aptos-testnet", 2],
  ["aptos-devnet", 3],
]);

export const ChainIdToNetwork = Object.fromEntries(
  [...SupportedEVMNetworks, ...SupportedSVMNetworks, ...SupportedAptosNetworks].map(network => [
    EvmNetworkToChainId.get(network) ||
      SvmNetworkToChainId.get(network) ||
      AptosNetworkToChainId.get(network),
    network,
  ]),
) as Record<number, Network>;
