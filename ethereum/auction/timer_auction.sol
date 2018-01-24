pragma solidity ^0.4.19;

import "./base_auction.sol";

contract TimerAuction is BaseAuction {
    string public itemDesc;
    uint public auctionEnd;
    address public maxBidder;
    uint public maxBid;
    bool ended = false;

    event BidAccepted(address maxBidder, uint amount);
    
    function TimerAuction(uint _durationMin, string _itemDesc) {
        itemDesc = _itemDesc;
        // 'now' - time when the transaction get mined
        auctionEnd = now + (_durationMin * 1 minutes);
    }
    
    function bid() payable {
        require(now < auctionEnd);
        require(msg.value > maxBid);
        
        if (maxBidder != 0) {
            maxBidder.send(maxBid);
        }
        
        maxBidder = msg.sender;
        maxBid = msg.value;
        
        BidAccepted(maxBidder, maxBid);
    }
    
    function end() ownerOnly {
        require(!ended);
        require(now >= auctionEnd);

        ended = true;
        AuctionComplete(maxBidder, maxBid);
        owner.send(maxBid);
    }
}
