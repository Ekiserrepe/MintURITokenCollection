//Modify these fields before running your code

//Number of URITokens (NFTs) you want to mint
const numberURIs = 5;
//Select your network "Testnet" or "Mainnet"
const net = "Testnet";
//Secret of your wallet (Don't share it!) Testnet address generator: https://xahau-test.net/ Fake example: "sn5XTrWNGNysp4o1JYEFp7wSbN6Gz"
const seed = "";
//Price of every NFT in XAH. Example: for 1 XAH price per NFT, put 1
const xah = 10;
//CID from tour ipfs files without 'ipfs://' part. Fake example: 'bafybeigyy2u2sbgtxxr2tdc6snxgefdo52bx2qy2nd3vjrjzaieg4yr3ce'
const ipfs_cid='';
//Burnable flag, 0 -> you can't burn other owners URITokens, 1 -> you can burn other owners URITokens
const burnable=0;
//End modify variables

//Don't touch anything after this line
const fs = require("fs");
const path = require("path");
const xrpl = require("xrpl");
const { derive, utils, signAndSubmit } = require("xrpl-accountlib");
const crypto = require("crypto");
const { XrplAccountLib } = require('xrpl');

async function main() {
  function esperar(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  const price=xah*1000000;
  let network="wss://xahau-test.net";
  let NetworkID=21338;
  if(net==="Mainnet"){
    network="wss://xahau.network";
    NetworkID=21337;
  }
  const carpeta = "/json_files";
  const account = derive.familySeed(seed);
  const client = new xrpl.Client(network);
  await client.connect();
  const my_wallet = xrpl.Wallet.fromSeed(seed);
  const networkInfo = await utils.txNetworkAndAccountValues(network, account);
  console.log(`Your public address is: ${my_wallet.address}`);
  const response = await client.request({
    command: "account_info",
    account: my_wallet.address,
    ledger_index: "validated",
  });
  const total_balance = (response.result.account_data.Balance)/1000000;
  const reserves = (response.result.account_data.OwnerCount*0.2)+1;
  console.log(`Your total balance (available+reserves) is: ${total_balance} XAH`);
  console.log(`Your reserves is: ${reserves} XAH`);
  const balance = total_balance-reserves;
  console.log(`Your available balance is: ${balance} XAH`);
  //The reserve per object is 0.2 but I prefer be safe
  const TicketTotalCost = numberURIs * 0.3;
  console.log(
    `To create the tickets needed, you need to have at least this balance: ${TicketTotalCost} XAH`
  );
  if (balance <= TicketTotalCost) {
    console.log(
      `To create the tickets needed, you need to have at least this balance: ${TicketTotalCost} XAH. I recommend have a bit more.`
    );
    client.disconnect();
    console.log(`Connection closed`);
  } else {
    //We check how many tickets you had before running the code
    let response = await client.request({
      command: "account_objects",
      account: my_wallet.address,
      type: "ticket",
    });
    let numberTickets = 0;
    if (
      Array.isArray(response.result.account_objects) &&
      response.result.account_objects.length > 0
    ) {
      numberTickets = response.result.account_objects.length;
      console.log(`This account has ${numberTickets} tickets already`);
    } else {
      console.log("This account has no tickets already");
    }

    const account_info = await client.request({
      command: "account_info",
      account: my_wallet.address,
    });
    numberTickets = numberURIs - numberTickets;
    console.log(`${numberTickets} tickets will be created`);
    if (numberTickets > 0) {
      let current_sequence = account_info.result.account_data.Sequence;
      console.log("Actual Sequence", current_sequence);
      //Generate tickets:
      const prepared = {
        TransactionType: "TicketCreate",
        Account: my_wallet.address,
        TicketCount: numberTickets,
        Sequence: current_sequence,
        ...networkInfo.txValues,
      };

      // Submit TicketCreate -------------------------------------------------------
      const tx = signAndSubmit(prepared, network, account);
      console.log("Info tx ", tx);
      const jsonDataString = JSON.stringify(tx);
      console.log(jsonDataString);
      //finished
      await esperar(10000);
    } else {
      console.log(
        `New tickets are not created. You have enough created already.`
      );
    }

    const response2 = await client.request({
      command: "account_objects",
      account: my_wallet.address,
      type: "ticket",
    });
    console.log(
      "Checking the tickets created are enough for your bulk minting, wait 10 seconds..."
    );
    let tickets = [];
    await esperar(10000);
    for (let i = 0; i < numberURIs; i++) {
      y = i + 1;
      tickets[i] = response2.result.account_objects[i].TicketSequence;
      console.log("Generated tickets nº ", y, tickets[i]);
    }
    console.log("Ticket generation finished");
    if (numberURIs > response2.result.account_objects.length) {
      console.log(`Tickets needed ${numberURIs}`);
      console.log(`Tickets created ${response2.result.account_objects.length}`);
      console.log(
        `You need more tickets to start the mint, re-execute this code.`
      );
    } else {
      console.log(`Tickets needed ${numberURIs}`);
      console.log(`Tickets created ${response2.result.account_objects.length}`);

      //Checking if every file is in the folder /json_files:
      let count_files = 0;
      for (let i = 0; i < numberURIs; i++) {
        const filePath = `./json_files/${i + 1}.json`;

        if (fs.existsSync(filePath)) {
          console.log(`File ${filePath} exists.`);
          count_files = count_files + 1;
        } else {
          console.log(`File ${filePath} DOESN'T exists.`);
        }
      }
      if (count_files != numberURIs) {
        console.log(`There are ${numberURIs - count_files} .json files that DONT exists. Please insert them to /json_files folder.`);
      } else {

        let digests = [];
        for (let i = 0; i < numberURIs; i++) {
          const jsonData = require(`./json_files/${i + 1}.json`);
          const jsonDataString = JSON.stringify(jsonData);
          digests[i] = crypto
            .createHash("sha512")
            .update(jsonDataString)
            .digest("hex")
            .slice(0, 64);
          console.log("Digest generated nº", i+1, digests[i]);
          
      }
      console.log(`Digests generated!`);
      console.log(`Let's mint!`);

      for (let i=0; i < numberURIs; i++) {
        y=i+1;
      const prepared = ({
        "TransactionType": "URITokenMint",
        "Account":my_wallet.address,
        "URI": xrpl.convertStringToHex(`ipfs://${ipfs_cid}/${y}.json`),
        "Digest": digests[i],
        "Flags":burnable,
        "Sequence":0,
        "TicketSequence": tickets[i],
        "Amount":`${price}`,
        "Fee":"100",
        "NetworkID":NetworkID,
      });
      const tx =  await signAndSubmit(prepared,network,account);
      console.log('TX submitted: ',y,tx);
      console.log(JSON.stringify(tx));
      }
      console.log('Mint finished. Enjoy!');
      console.log('Feel free to donate to: rf1NrYAsv92UPDd8nyCG4A3bez7dhYE61r or follow me @ekiserrepe');
    }
}

    await client.disconnect();
    console.log(`Connection closed`);
  }

}
main();
