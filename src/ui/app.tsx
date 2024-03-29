/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-use-before-define */
import React, { useEffect, useState } from 'react';
import Web3 from 'web3';
import { ToastContainer, toast } from 'react-toastify';
import './app.scss';
import 'react-toastify/dist/ReactToastify.css';
import { PolyjuiceHttpProvider } from '@polyjuice-provider/web3';
import { AddressTranslator } from 'nervos-godwoken-integration';

import { SimpleNFTWrapper } from '../lib/contracts/SimpleNFTWrapper';
import { CONFIG } from '../config';

async function createWeb3() {
    // Modern dapp browsers...
    if ((window as any).ethereum) {
        const godwokenRpcUrl = CONFIG.WEB3_PROVIDER_URL;
        const providerConfig = {
            rollupTypeHash: CONFIG.ROLLUP_TYPE_HASH,
            ethAccountLockCodeHash: CONFIG.ETH_ACCOUNT_LOCK_CODE_HASH,
            web3Url: godwokenRpcUrl
        };

        const provider = new PolyjuiceHttpProvider(godwokenRpcUrl, providerConfig);
        const web3 = new Web3(provider || Web3.givenProvider);

        try {
            // Request account access if needed
            await (window as any).ethereum.enable();
        } catch (error) {
            // User denied account access...
        }

        return web3;
    }

    console.log('Non-Ethereum browser detected. You should consider trying MetaMask!');
    return null;
}

export function App() {
    const [web3, setWeb3] = useState<Web3>(null);
    const [contract, setContract] = useState<SimpleNFTWrapper>();
    const [accounts, setAccounts] = useState<string[]>();
    const [l2Balance, setL2Balance] = useState<bigint>();
    const [existingContractIdInputValue, setExistingContractIdInputValue] = useState<string>();
    const [storedValue, setStoredValue] = useState<number | undefined>();
    const [deployTxHash, setDeployTxHash] = useState<string | undefined>();
    const [polyjuiceAddress, setPolyjuiceAddress] = useState<string | undefined>();
    const [transactionInProgress, setTransactionInProgress] = useState(false);
    const [imgUrl, setImgUrl] = useState('');
    const [listNFT, setListNFT] = useState([]);
    const [layer2Address, setLayer2Address] = useState<string | undefined>();
    const [sudtBalance, setSudtBalance] = useState<number | 0>();

    const toastId = React.useRef(null);
    const [newStoredNumberInputValue, setNewStoredNumberInputValue] = useState<
        number | undefined
    >();

    useEffect(() => {
        if (accounts?.[0]) {
            const addressTranslator = new AddressTranslator();
            setPolyjuiceAddress(addressTranslator.ethAddressToGodwokenShortAddress(accounts?.[0]));
        } else {
            setPolyjuiceAddress(undefined);
        }
    }, [accounts?.[0]]);

    useEffect(() => {
        if (transactionInProgress && !toastId.current) {
            toastId.current = toast.info(
                'Transaction in progress. Confirm MetaMask signing dialog and please wait...',
                {
                    position: 'top-right',
                    autoClose: false,
                    hideProgressBar: false,
                    closeOnClick: false,
                    pauseOnHover: true,
                    draggable: true,
                    progress: undefined,
                    closeButton: false
                }
            );
        } else if (!transactionInProgress && toastId.current) {
            toast.dismiss(toastId.current);
            toastId.current = null;
        }
    }, [transactionInProgress, toastId.current]);

    const account = accounts?.[0];

    async function getLater2Address(account: string, web3: Web3) {
        const addressTranslator = new AddressTranslator();
        const depositAddress = await addressTranslator.getLayer2DepositAddress(web3, account);
        console.log(depositAddress.addressString)
        return depositAddress.addressString
    }

    const CompiledContractArtifact = require(`../abi/ERC20.json`);
    const SUDT_PROXY_CONTRACT_ADDRESS = "0xC7f4a0591055c3fEeE72065931D2C74b1C93FAd6";

    async function getSUDTBalance(account: string, web3: Web3, polyjuiceAddress:string) {
        console.log(polyjuiceAddress);
        const contract = new web3.eth.Contract(CompiledContractArtifact.abi, SUDT_PROXY_CONTRACT_ADDRESS);
        const balance = await contract.methods.balanceOf(polyjuiceAddress).call({
            from: account
        })
        console.log(balance);

        return balance
    }

    useEffect(() => {
        if (contract) {
            setInterval(() => {
                contract.getListNFT(account).then(setListNFT);
            }, 10000);
        }
    }, [contract]);

    async function deployContract() {
        const _contract = new SimpleNFTWrapper(web3);

        try {
            setDeployTxHash(undefined);
            setTransactionInProgress(true);

            const transactionHash = await _contract.deploy(account);

            setDeployTxHash(transactionHash);
            setExistingContractAddress(_contract.address);
            toast(
                'Successfully deployed a smart-contract. You can now proceed to get or set the value in a smart contract.',
                { type: 'success' }
            );
        } catch (error) {
            console.error(error);
            toast.error(
                'There was an error sending your transaction. Please check developer console.'
            );
        } finally {
            setTransactionInProgress(false);
        }
    }

    // async function getStoredValue() {
    //     const value = await contract.getStoredValue(account);
    //     toast('Successfully read latest stored value.', { type: 'success' });

    //     setStoredValue(value);
    // }

    async function setExistingContractAddress(contractAddress: string) {
        const _contract = new SimpleNFTWrapper(web3);
        _contract.useDeployed(contractAddress.trim());

        setContract(_contract);
        setStoredValue(undefined);
    }

    async function createNFT() {
        try {
            setTransactionInProgress(true);
            // await contract.setStoredValue(newStoredNumberInputValue, account);
            await contract.createNFT(imgUrl, account);
            toast('Successfully create nft', { type: 'success' });
        } catch (error) {
            console.error(error);
            toast.error('Faily create nft');
        } finally {
            setTransactionInProgress(false);
        }
    }

    useEffect(() => {
        if (web3) {
            return;
        }

        (async () => {
            const _web3 = await createWeb3();
            setWeb3(_web3);

            const _accounts = [(window as any).ethereum.selectedAddress];
            setAccounts(_accounts);
            console.log({ _accounts });

            if (_accounts && _accounts[0]) {
                const _l2Balance = BigInt(await _web3.eth.getBalance(_accounts[0]));
                setL2Balance(_l2Balance);
                const l2Address = await getLater2Address(_accounts[0], _web3);
                setLayer2Address(l2Address);
                const addressTranslator = new AddressTranslator();
                const polyjuiceAddress = addressTranslator.ethAddressToGodwokenShortAddress(_accounts[0]);
                const balance = await getSUDTBalance(_accounts[0], _web3, polyjuiceAddress);
                setSudtBalance(balance);
            }
        })();
    });

    const LoadingIndicator = () => <span className="rotating-icon">⚙️</span>;

    return (
        <div>
            Your ETH address: <b>{accounts?.[0]}</b>
            <br />
            <br />
            Your Polyjuice address: <b>{polyjuiceAddress || ' - '}</b>
            <br />
            <br />
            Nervos Layer 2 balance:{' '}
            <b>{l2Balance ? (l2Balance / 10n ** 8n).toString() : <LoadingIndicator />} CKB</b>
            <br />
            <br />
            Deployed contract address: <b>{contract?.address || '-'}</b> <br />
            Deploy transaction hash: <b>{deployTxHash || '-'}</b>
            <br />
            <br />
            <h3>Transfer assets from the Ethereum blockchain via Force Bridge</h3>
            Your Layer 2 Deposit Address on Layer 1: <b>{layer2Address}</b><br /><br />
            Use the <a href="https://force-bridge-test.ckbapp.dev/bridge/Ethereum/Nervos">Force bridge website</a> to transfer tokens from Ethereum to Nervos layer 2.<br />
            Select the Ethereum asset and amount to transfer across the bridge. In the box marked "Recipient", you will specify the Nervos destination address for the funds: input your the Layer 2 Deposit Address on Layer 1 mentioned above.<br />
            When you have finished inputting and reviewing your selections, click the <i>Bridge</i> button. You will be asked to sign the transaction using MetaMask as seen below. There will be a small fee for the transfer, and this will be calculated automatically.<br />
            <br />
            Your SUDT balance: <b>{sudtBalance}</b><br />
            <br />
            <hr />
            <button onClick={deployContract} disabled={!l2Balance}>
                Deploy contract
            </button>
            &nbsp;or&nbsp;
            <input
                placeholder="Existing contract id"
                onChange={e => setExistingContractIdInputValue(e.target.value)}
            />
            <button
                disabled={!existingContractIdInputValue || !l2Balance}
                onClick={() => setExistingContractAddress(existingContractIdInputValue)}
            >
                Use existing contract
            </button>
            <br />
            <br />
            {/* <button onClick={getStoredValue} disabled={!contract}>
                Get stored value
            </button>
            {storedValue ? <>&nbsp;&nbsp;Stored value: {storedValue.toString()}</> : null} */}
            <br />
            <br />
            <input
                type="string"
                placeholder="image url"
                // onChange={e => setNewStoredNumberInputValue(parseInt(e.target.value, 10))}
                onChange={e => setImgUrl(e.target.value)}
            />
            <button onClick={createNFT} disabled={!contract}>
                create NFT
            </button>
            <br />
            <div>
                <h4>NFT List</h4>
                {listNFT.map(_uri => (
                    <img
                        key={_uri}
                        src={_uri}
                        style={{ width: 100, height: 100, border: '1px solid black' }}
                    />
                ))}
            </div>
            <br />
            <br />
            <br />
            <br />
            <hr />
            The contract is deployed on Nervos Layer 2 - Godwoken + Polyjuice. After each
            transaction you might need to wait up to 120 seconds for the status to be reflected.
            <ToastContainer />
        </div>
    );
}
