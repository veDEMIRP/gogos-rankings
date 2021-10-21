// Calculate rarity scores and ranks for GOGOs using TZKT on Tezos Blockchain
//
// Created by PRIME Dev & Kevin Elliott
//
// Github: https://github.com/veDEMIRP/gogos-rankings
// Twitter: https://twitter.com/DosEsposas
// Twitter: https://twitter.com/kevinelliott

import { bytes2Char } from '@taquito/utils';
import axios from 'axios';
import fs from 'fs';

// SETTINGS

const IPFS_BASE_URL = 'https://cloudflare-ipfs.com/ipfs';
const TZKT_BASE_URL = 'https://api.tzkt.io/v1';
const GOGOS_TOKEN_CONTRACT = 'KT1SyPgtiXTaEfBuMZKviWGNHqVrBBEjvtfQ';
const GOGOS_TZKT_URL = `${TZKT_BASE_URL}/contracts/${GOGOS_TOKEN_CONTRACT}/bigmaps/token_metadata/keys?active=true&select=value&limit=10000`;
const COLLECTION_TOTAL = 5555;
const DEBUG = false;

// INITIALIZATIONS

let tokens = {};
let attributeNames = [];
let attributeValues = {};
let attributeCounts = {};
let attributeRarityScores = {};
let attributeRarityPercentages = {};
let tokensSortedById = [];
let tokensSortedByRank = [];

// FUNCTIONS

async function getGogosIPFSList() {
  console.log('Getting token info for all GOGOs from TZKT');
  const response = await axios.get(GOGOS_TZKT_URL);
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
  const ipfsUrl = ipfsUri.replace('ipfs://', IPFS_BASE_URL + '/');
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

function sortTokensById() {
  tokensSortedById = Object.keys(tokens).map((key) => {
    const token = tokens[key];
    return token;
  });
  tokensSortedById = tokensSortedById.sort((a, b) => a.id - b.id);
}

function sortTokensByRank() {
  tokensSortedByRank = Object.keys(tokens).map((key) => {
    const token = tokens[key];
    return token;
  });
  tokensSortedByRank = tokensSortedByRank.sort((a, b) => b.rarityScore - a.rarityScore);
}

function exportTokenRanksToCsv() {
  const filename = 'gogos-by-rank.csv';
  const csvLines = ['rank,id,score'];
  for (const [i, token] of tokensSortedByRank.entries()) {
    csvLines.push(`${i+1},${String(token.id).padStart(4, '0')},${token.rarityScore}`);
  }
  fs.writeFileSync(filename, csvLines.join('\n'));
}

function exportTokensToCsv() {
  const filename = 'gogos-by-id.csv';
  const csvLines = ['id,rank,score'];
  for (const [i, token] of tokensSortedByRank.entries()) {
    csvLines.push(`${String(token.id).padStart(4, '0')},${i+1},${token.rarityScore}`);
  }
  fs.writeFileSync(filename, csvLines.join('\n'));
}


// MAIN

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
sortTokensById();
sortTokensByRank();

// SUMMARY DEBUG OUTPUT

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
  console.log(JSON.stringify(tokensSortedByRank));
}

exportTokensToCsv();
exportTokenRanksToCsv();
