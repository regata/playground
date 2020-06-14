import React from 'react'

function ProductCategoryRow(props) {
    return (
        <tr>
            <th colSpan='2'>
                {props.category}
            </th>
        </tr>
    );
}

function ProductRow(props) {
    const product = props.product;
    
    let name = product.name;
    if (!product.stocked) {
        name = (<span style={{color: 'red'}}>
            {name}
        </span>);
    }

    return (
        <tr>
            <td>{name}</td>
            <td>{product.price}</td>
        </tr>
    );
}

function ProductTable(props) {
    const searchText = props.searchText;
    const inStockOnly = props.inStockOnly;

    const rows = [];
    let currentCategory = null;

    props.products.forEach( product => {
        if (product.name.toLowerCase().indexOf(searchText.toLowerCase()) === -1) {
            return;
        }
        if (inStockOnly && !product.stocked) {
            return;
        }

        if (product.category !== currentCategory) {
            rows.push(
                <ProductCategoryRow
                    category={product.category}
                    key={product.category}
                />
            );
        }

        rows.push(
            <ProductRow
                product={product}
                key={product.name}
            />
        );
        currentCategory = product.category;
    });

    return (
        <table>
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Price</th>
                </tr>
            </thead>
            <tbody>
                {rows}
            </tbody>
        </table>
    );
}

class SearchBar extends React.Component {
    constructor(props) {
        super(props);
        this.handleSearchTextChange = this.handleSearchTextChange.bind(this);
        this.handleInStockOnlyChange = this.handleInStockOnlyChange.bind(this);
    }

    handleSearchTextChange(e) {
        this.props.onSearchTextChange(e.target.value);
    }

    handleInStockOnlyChange(e) {
        console.log(e.target.checked);
        this.props.onInStockOnlyChange(e.target.checked);
    }

    render() {
        return (
            <form>
                <input
                    type='text'
                    placeholder='Search...'
                    value={this.props.searchText}
                    onChange={this.handleSearchTextChange}
                />
                <p>
                    <input
                        type='checkbox'
                        checked={this.props.inStockOnly}
                        onChange={this.handleInStockOnlyChange}
                    />
                    {'  '}
                    Only show products in stock
                </p>
            </form>
        );
    }
}

export default class FilterableProductTable extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            searchText: '',
            inStockOnly: false
        };

        this.handleSearchTextChange = this.handleSearchTextChange.bind(this);
        this.handleInStockOnlyChange = this.handleInStockOnlyChange.bind(this);
    }

    handleSearchTextChange(searchText) {
        this.setState({searchText: searchText});
    }

    handleInStockOnlyChange(inStockOnly) {
        this.setState({inStockOnly: inStockOnly});
    }

    render() {
        return (
            <div>
                <SearchBar
                    searchText={this.state.searchText}
                    inStockOnly={this.state.inStockOnly}
                    onSearchTextChange={this.handleSearchTextChange}
                    onInStockOnlyChange={this.handleInStockOnlyChange}
                />
                <ProductTable
                    products={this.props.products}
                    searchText={this.state.searchText}
                    inStockOnly={this.state.inStockOnly}
                />
            </div>
        );
    }
}