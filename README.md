# gogos-rankings
Tezos GOGOs PFP NFT rarity scoring and rankings calculator

# How to Run

Assuming you have Node v14 installed and selected perform the following:

1) `yarn install`
2) `yarn start`

This will pull down the GOGOs data, process it, and store rankings and scores to `gogos-rarity-scores.csv`.

It will also cache JSON of the IPFS metadata for each token in `ipfs_cache/`.
