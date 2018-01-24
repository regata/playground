pragma solidity ^0.4.19;

contract Escrow {

    address public buyer;
    address public seller;
    
    enum State {
        AWAIT_PAYMENT,
        AWAIT_DELIVERY,
        COMPLETE
    }

    State public state;
    
    modifier buyerOnly() {
        require(msg.sender == buyer);
        _;
    }
    
    modifier inState(State expected) {
        require(state == expected);
        _;
    }
    
    function Escrow(address _buyer, address _seller) {
        buyer = _buyer;
        seller = _seller;
    }
    
    // 'payable' - modifier so it can receive money
    function confirmPayment() buyerOnly  inState(State.AWAIT_PAYMENT) payable {
        state = State.AWAIT_DELIVERY;
    }

    function confirmDelivery() buyerOnly inState(State.AWAIT_DELIVERY) {
        seller.send(this.balance);
        state = State.COMPLETE;
    }
}
