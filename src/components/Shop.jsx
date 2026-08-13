'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import PageTemplate from './PageTemplate'
import { FiSearch, FiPackage, FiShoppingBag } from 'react-icons/fi'

export default function ShopFront() {
  const { branch } = useAuth()
  const { settings } = useSettings()
  const [products, setProducts] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const currency = settings?.currency_symbol || 'Rs. '

  useEffect(() => {
    if (branch) {
      loadProducts()
    }
  }, [branch])

  const loadProducts = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('branch_products')
        .select('id, price, stock_quantity, products!inner(sku, name)')
        .eq('branch_id', branch)
        .is('products.deleted_at', null)

      if (error) throw error

      if (data) {
        setProducts(data.map(p => ({
          id: p.id,
          sku: p.products?.sku || 'N/A',
          name: p.products?.name || 'Unnamed',
          price: p.price || 0,
          stock: p.stock_quantity || 0
        })))
      }
    } catch (err) {
      console.error('Error loading shop products:', err)
    } finally {
      setLoading(false)
    }
  }

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.sku.toLowerCase().includes(search.toLowerCase())
  )

  const metrics = [
    { label: 'Total Products', value: products.length, icon: '🛍️' },
    { label: 'In Stock Items', value: products.filter(p => p.stock > 0).length, icon: '📦' },
    { label: 'Out of Stock', value: products.filter(p => p.stock <= 0).length, icon: '⚠️' }
  ]

  return (
    <PageTemplate
      title="🏪 Shop Catalog"
      subtitle="View all available products, pricing, and current stock levels"
      metrics={metrics}
    >
      <div className="flex flex-col h-full gap-6 pb-10">
        
        {/* Search Bar */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex items-center gap-3">
          <FiSearch className="text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="Search products by name or SKU..." 
            className="w-full bg-transparent border-none outline-none text-gray-900 dark:text-white text-base"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Product Grid */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 space-y-3 mt-10">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent"></div>
            <p>Loading catalog...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 space-y-3 mt-10 opacity-60">
            <FiShoppingBag size={48} />
            <p className="text-lg">No products found matching your search.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredProducts.map((product) => {
              const isOutOfStock = product.stock <= 0;
              
              return (
                <div 
                  key={product.id} 
                  className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col transition-all duration-200 hover:shadow-md hover:-translate-y-1 ${isOutOfStock ? 'opacity-70 grayscale-[30%]' : ''}`}
                >
                  {/* Image Placeholder */}
                  <div className="h-32 bg-gray-100 dark:bg-gray-700 flex items-center justify-center relative">
                    <FiPackage className="text-gray-300 dark:text-gray-600" size={40} />
                    {isOutOfStock && (
                      <div className="absolute inset-0 bg-white/60 dark:bg-black/60 flex items-center justify-center backdrop-blur-[1px]">
                        <span className="bg-red-600 text-white text-xs font-extrabold px-3 py-1 rounded-full uppercase tracking-widest shadow-lg transform -rotate-12">
                          Out of Stock
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Product Details */}
                  <div className="p-4 flex flex-col flex-1">
                    <div className="text-[10px] text-gray-500 font-mono mb-1">{product.sku}</div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-sm line-clamp-2 mb-2 flex-1">
                      {product.name}
                    </h3>
                    
                    <div className="flex items-end justify-between mt-auto pt-3 border-t border-gray-100 dark:border-gray-700">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Price</span>
                        <span className="font-extrabold text-blue-600 dark:text-blue-400">
                          {currency}{product.price.toLocaleString()}
                        </span>
                      </div>
                      
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Stock</span>
                        <span className={`font-bold text-sm ${isOutOfStock ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
                          {product.stock}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </PageTemplate>
  )
}