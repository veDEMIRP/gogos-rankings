// Calculate rarity scores and ranks for GOGOs using TZKT on Tezos Blockchain
//
// Twitter: kevinelliott

import { bytes2Char } from '@taquito/utils';
import axios from 'axios';
import fs from 'fs';

// SETTINGS

const COLLECTION_TOTAL = 5555;
const IPFS_BASE_URL = 'https://cloudflare-ipfs.com/ipfs/';
const DEBUG = false;

// INITIALIZATIONS

let tokens = {};
let attributeNames = [];
let attributeValues = {};
let attributeCounts = {};
let attributeRarityScores = {};
let attributeRarityPercentages = {};
let tokenRanks = [];

// FUNCTIONS

async function getGogosIPFSList() {
  console.log('Getting token info for all GOGOs from TZKT');
  const tzktUrl = 'https://api.tzkt.io/v1/contracts/KT1SyPgtiXTaEfBuMZKviWGNHqVrBBEjvtfQ/bigmaps/token_metadata/keys?active=true&select=value&limit=10000';
  const response = await axios.get(tzktUrl);
  const tokens = response.data;
  console.log(`Discovered ${tokens.length} GOGOs`);

  const list = [];
  for (const token of tokens) {
    const tokenId = token.token_id;
    const ipfsUri = bytes2Char(token.token_info['']);
    list.push({ tokenId: tokenId, ipfsUri: ipfsUri });
  }

  return list;
}

async function getTokenMetadataFromIPFS(ipfsUri) {
  const ipfsUrl = ipfsUri.replace('ipfs://', IPFS_BASE_URL);
  // const ipfsUrl = ipfsUri.replace('ipfs://', 'https://ipfs.fleek.co/ipfs/');
  const response = await axios.get(ipfsUrl);
  return response.data;
}

async function cacheData(data, filename) {
  if (fs.existsSync(filename)) {
    console.log(`Skipping. Cached token metadata exists already at ${filename}`);
  } else {
    const json = JSON.stringify(data);
    fs.writeFileSync(filename, json);
  }
}

const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

async function loadCacheOrGetTokenMetadataFromIPFS(item) {
  const filename = `ipfs_cache/gogo_${item.tokenId}.json`;
  let tokenMetadata;

  if (fs.existsSync(filename)) {
    tokenMetadata = JSON.parse(fs.readFileSync(filename));
    console.log(`Loading token metadata from cache for Token ID ${item.tokenId}`);
    if (tokenMetadata.attributes.length == 1 && tokenMetadata.attributes[0].name == 'Vital Signs' && tokenMetadata.attributes[0].value == 'Normal') {
      console.log(`Cache contains stale data from pre-hatch for Token ID ${item.tokenId}.`);
      console.log(tokenMetadata.attributes);
      fs.unlinkSync(filename);
      await sleep(1000);
      console.log(`Refetching token metadata from IPFS for Token ID ${item.tokenId}`);
      tokenMetadata = await getTokenMetadataFromIPFS(item.ipfsUri);
      console.log(tokenMetadata.attributes);
      await cacheData(tokenMetadata, filename);
    }
  } else {
    console.log(`Retrieving token metadata from IPFS for Token ID ${item.tokenId}`);
    tokenMetadata = await getTokenMetadataFromIPFS(item.ipfsUri);
    await cacheData(tokenMetadata, filename);
  }
  return tokenMetadata;
}

function incrementAttribute(attribute) {
  if (attributeNames.indexOf(`${attribute.name}`) < 0) {
    attributeNames.push(`${attribute.name}`);
  }

  if (!!!attributeValues[`${attribute.name}`]) {
    attributeValues[`${attribute.name}`] = [];
  }

  if (attributeValues[`${attribute.name}`].indexOf(`${attribute.value}`) < 0) {
    attributeValues[`${attribute.name}`].push(`${attribute.value}`);
  }


  if (!!!attributeCounts[`${attribute.name}`]) {
    attributeCounts[`${attribute.name}`] = {};
  }
  if (!!!attributeCounts[`${attribute.name}`][`${attribute.value}`]) {
    attributeCounts[`${attribute.name}`][`${attribute.value}`] = 0;
  }
  attributeCounts[`${attribute.name}`][`${attribute.value}`] = attributeCounts[`${attribute.name}`][`${attribute.value}`] + 1;
}

function calculateAttributeRarityScores(totals) {
  for (const name of attributeNames) {
    for (const value of attributeValues[`${name}`]) {
      const itemsWithTraitCount = attributeCounts[`${name}`][`${value}`];
      attributeRarityScores[`${name} - ${value}`] = 1 / (itemsWithTraitCount / COLLECTION_TOTAL);
    }
  }
}

function calculateAttributeRarityPercentages(totals) {
  for (const name of attributeNames) {
    for (const value of attributeValues[`${name}`]) {
      const itemsWithTraitCount = attributeCounts[`${name}`][`${value}`];
      attributeRarityPercentages[`${name} - ${value}`] = itemsWithTraitCount / COLLECTION_TOTAL;
    }
  }
}

function calculateTokenRarityScores() {
  tokens = Object.values(tokens).map((token) => {
    let rarityScore = 0;
    for (const attr of token.attributes) {
      rarityScore += attributeRarityScores[`${attr.name} - ${attr.value}`];
    }
    token.rarityScore = rarityScore;
    return token;
  });
}

function calculateTokenRanks() {
  // TODO: Implement!
  tokenRanks = Object.keys(tokens).map((key) => {
    const token = tokens[key];
    return token;
  });
  tokenRanks = tokenRanks.sort((a, b) => b.rarityScore - a.rarityScore);
}

function exportTokenRanks() {
  const filename = 'gogos-rarity-scores.csv';
  const csvLines = ['rank,id,score'];
  for (const [i, token] of tokenRanks.entries()) {
    csvLines.push(`${i+1},${token.id},${token.rarityScore}`);
  }
  fs.writeFileSync(filename, csvLines.join('\n'));
}


const ipfsList = await getGogosIPFSList();
const items = [];
let ids = ipfsList.map(i => parseInt(i.tokenId));
ids = ids.sort((a, b) => a - b);
for (const id of ids) {
  const item = ipfsList.find(i => i.tokenId == id);
  const tokenMetadata = await loadCacheOrGetTokenMetadataFromIPFS(item);

  // console.log(tokenMetadata);
  const attributes = [];
  for (const attr of tokenMetadata.attributes) {
    const attribute = {
      name: attr.name,
      value: attr.value
    };
    attributes.push(attribute);
    incrementAttribute(attribute);
  }
  const rankingDetail = {
    id: item.tokenId,
    rank: 0,
    score: 0,
    name: tokenMetadata.name,
    displayUri: tokenMetadata.displayUri,
    attributes: attributes
  };
  tokens[`${item.tokenId}`] = rankingDetail;
}

// CALCULATIONS
calculateAttributeRarityScores();
calculateAttributeRarityPercentages();
calculateTokenRarityScores();
calculateTokenRanks();

// SUMMARY OUTPUT
// const json = JSON.stringify(items);
// console.log('Everything');
// console.log(json);

if (DEBUG) {
  console.log('');
  console.log('Attribute Counts');
  console.log(JSON.stringify(attributeCounts));
  console.log('');
  console.log('Attribute Rarity Scores');
  console.log(JSON.stringify(attributeRarityScores));
  console.log('');
  console.log('Attribute Rarity Percentages');
  console.log(JSON.stringify(attributeRarityPercentages));
  console.log('Tokens (By rarity scores)');
  console.log(JSON.stringify(tokens));
  console.log('Token (By rank)');
  console.log(JSON.stringify(tokenRanks));
}

exportTokenRanks();
